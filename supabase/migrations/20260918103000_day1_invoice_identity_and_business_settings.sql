alter table public.business_settings add column if not exists upi_qr_data_url text;

update public.business_settings
set business_name='Mane Masala',
    whatsapp='9535000003',
    invoice_tagline='FROM MY HOME TO YOURS — WITH RESPONSIBILITY',
    invoice_promise_statement='Made to Order • Pure Ingredients • No Preservatives',
    updated_at=now();

create unique index if not exists invoices_invoice_number_unique
on public.invoices(invoice_number)
where invoice_number is not null;
