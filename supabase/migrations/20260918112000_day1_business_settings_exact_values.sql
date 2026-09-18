-- Day-1 authoritative Mane Masala business settings correction.
-- Historical invoices are intentionally untouched.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.business_settings) THEN
    UPDATE public.business_settings
    SET business_name = 'Mane Masala', phone = '9535000003', whatsapp = '9535000003',
        email = 'informanemasala@gmail.com', address = 'B308 Foundation Silver Spring, KRS Road, Hootagalli-560018',
        gst_number = NULL, financial_year_start_month = 4, financial_year_start_day = 1, currency_code = 'INR',
        upi_id = '9731763755-2@ybl', fssai_number = '21226130000752', authorised_signatory_name = 'Shruthi Praveen',
        authorised_signatory_designation = 'Founder', invoice_tagline = 'FROM MY HOME TO YOURS — WITH RESPONSIBILITY',
        invoice_promise_statement = 'Made to Order • Pure Ingredients • No Preservatives',
        accepted_payment_methods = 'UPI transfer', upi_qr_data_url = NULL, updated_at = now();
  ELSE
    INSERT INTO public.business_settings
      (business_name,phone,whatsapp,email,address,gst_number,financial_year_start_month,financial_year_start_day,currency_code,upi_id,fssai_number,authorised_signatory_name,authorised_signatory_designation,invoice_tagline,invoice_promise_statement,accepted_payment_methods,upi_qr_data_url)
    VALUES
      ('Mane Masala','9535000003','9535000003','informanemasala@gmail.com','B308 Foundation Silver Spring, KRS Road, Hootagalli-560018',NULL,4,1,'INR','9731763755-2@ybl','21226130000752','Shruthi Praveen','Founder','FROM MY HOME TO YOURS — WITH RESPONSIBILITY','Made to Order • Pure Ingredients • No Preservatives','UPI transfer',NULL);
  END IF;
END $$;
