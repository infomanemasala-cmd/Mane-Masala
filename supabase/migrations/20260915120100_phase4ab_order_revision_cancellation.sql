-- Phase 4A/4B order state-machine edge cases.
-- Cancellation releases reservations/cancels unfinished production while preserving history.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_user uuid:=auth.uid(); v_status text; v_produced numeric; v_dispatched numeric;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NULLIF(btrim(COALESCE(p_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'Cancellation reason is required'; END IF;
 SELECT status INTO v_status FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF v_status IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF v_status IN ('dispatched','completed','cancelled') THEN RAISE EXCEPTION 'Order cannot be cancelled from status %',v_status; END IF;
 SELECT COALESCE(SUM(produced_quantity),0),COALESCE(SUM(dispatched_quantity),0) INTO v_produced,v_dispatched FROM public.order_lines WHERE order_id=p_order_id;
 IF v_dispatched>0 THEN RAISE EXCEPTION 'Order cannot be cancelled after dispatch has started'; END IF;
 UPDATE public.stock_reservations SET status='released',updated_at=now() WHERE order_id=p_order_id AND status='active';
 UPDATE public.production_batches SET status='cancelled',updated_at=now() WHERE order_id=p_order_id AND status NOT IN ('completed','cancelled');
 UPDATE public.orders SET status='cancelled',notes=concat_ws(E'\n',notes,'Cancellation: '||btrim(p_reason)),updated_at=now() WHERE id=p_order_id;
 PERFORM public.record_audit_event('order.cancelled','order',p_order_id,jsonb_build_object('reason',btrim(p_reason),'produced_quantity',v_produced),'application');
 RETURN jsonb_build_object('order_id',p_order_id,'status','cancelled','produced_quantity',v_produced);
END; $$;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid,text) TO authenticated;

-- Revision is history-preserving and safe after production begins: active reservations and unfinished production are released/cancelled; completed production remains historical stock.
CREATE OR REPLACE FUNCTION public.revise_order(p_order_id uuid,p_reason text,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_user uuid:=auth.uid();v_status text;v_line jsonb;v_id uuid;v_qty numeric;v_rate numeric;v_old_item uuid;v_dispatched numeric;v_produced numeric;v_count int:=0;v_existing int:=0;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NULLIF(btrim(COALESCE(p_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'Revision reason is required'; END IF;
 IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'At least one revised order line is required'; END IF;
 SELECT status INTO v_status FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF v_status IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF v_status IN ('dispatched','completed','cancelled') THEN RAISE EXCEPTION 'Order cannot be revised from status %',v_status; END IF;
 INSERT INTO public.order_revisions(order_id,revision_number,reason,snapshot,created_by)
 SELECT p_order_id,COALESCE(MAX(revision_number),0)+1,btrim(p_reason),jsonb_build_object('status',v_status,'lines',COALESCE(jsonb_agg(jsonb_build_object('id',ol.id,'item_id',ol.item_id,'ordered_quantity',ol.ordered_quantity,'unit_id',ol.unit_id,'selling_rate',ol.selling_rate,'discount_amount',ol.discount_amount,'tax_amount',ol.tax_amount,'reserved_quantity',ol.reserved_quantity,'produced_quantity',ol.produced_quantity,'dispatched_quantity',ol.dispatched_quantity,'notes',ol.notes) ORDER BY ol.id),'[]'::jsonb)),v_user
 FROM public.order_lines ol WHERE ol.order_id=p_order_id;
 UPDATE public.stock_reservations SET status='released',updated_at=now() WHERE order_id=p_order_id AND status='active';
 UPDATE public.production_batches SET status='cancelled',updated_at=now() WHERE order_id=p_order_id AND status NOT IN ('completed','cancelled');
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
   v_id:=NULLIF(v_line->>'order_line_id','')::uuid;v_qty:=(v_line->>'ordered_quantity')::numeric;v_rate:=COALESCE((v_line->>'selling_rate')::numeric,0);
   IF v_id IS NULL OR v_qty IS NULL OR v_qty<=0 OR v_rate<0 THEN RAISE EXCEPTION 'Each revised line requires a valid line, positive quantity and non-negative rate'; END IF;
   SELECT item_id,COALESCE(produced_quantity,0),COALESCE(dispatched_quantity,0) INTO v_old_item,v_produced,v_dispatched FROM public.order_lines WHERE id=v_id AND order_id=p_order_id FOR UPDATE;
   IF v_old_item IS NULL THEN RAISE EXCEPTION 'Revised order line does not belong to this order'; END IF;
   IF v_qty<v_produced+v_dispatched THEN RAISE EXCEPTION 'Revised quantity cannot be below already produced/dispatched quantity for line %',v_id; END IF;
   UPDATE public.order_lines SET ordered_quantity=v_qty,selling_rate=v_rate,notes=NULLIF(btrim(v_line->>'notes'),''),reserved_quantity=0,updated_at=now() WHERE id=v_id;
   v_count:=v_count+1;
 END LOOP;
 SELECT COUNT(*) INTO v_existing FROM public.order_lines WHERE order_id=p_order_id;
 IF v_count<>v_existing THEN RAISE EXCEPTION 'Revision must include every existing order line; line additions/removals require a separate workflow'; END IF;
 UPDATE public.orders SET status='received',notes=concat_ws(E'\n',notes,'Revision: '||btrim(p_reason)),updated_at=now() WHERE id=p_order_id;
 PERFORM public.record_audit_event('order.revised','order',p_order_id,jsonb_build_object('reason',btrim(p_reason),'line_count',v_count),'application');
 RETURN jsonb_build_object('order_id',p_order_id,'status','received','revision_reason',btrim(p_reason));
END; $$;
REVOKE EXECUTE ON FUNCTION public.revise_order(uuid,text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.revise_order(uuid,text,jsonb) TO authenticated;
