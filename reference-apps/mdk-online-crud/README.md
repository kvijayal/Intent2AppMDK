# mdk-online-crud

Online CRUD MDK reference app using SAP ESPM OData service.
Demonstrates: Customers entity with List/Detail/Create/Edit/Delete pages,
full action chains, rules, and i18n.

**Source:** SAP-samples/cloud-mdk-tutorial-samples (Apache-2.0)
Adapted from: 2-Create-Your-First-Mobile-App-with-the-mobile-development-kit

## OData Service
Uses the SAP ESPM sample OData service available in SAP Mobile Services cockpit.
Entity sets: Customers, Products, PurchaseOrders, SalesOrders, Stock

## How to Use
This starter is copied by mdk_create (scope: project, templateType: crud).

1. Generate .service.metadata via VS Code MDK extension
2. Replace placeholder service path with your real service
3. Validate: npx @sap/mdk-tools validate --project .
4. Deploy: npx @sap/mdk-tools deploy --target mobile --showqr --project .

## Key patterns demonstrated
- ObjectTable list with search and footer count
- ObjectHeader + KeyValue detail layout
- FormCell create/edit with IsRequired validation
- Full CRUD action chain (CheckRequiredFields → CreateEntity → Success/Failed toast)
- Confirm delete dialog before DeleteEntity
- Modal navigation for create/edit pages
- DataSubscriptions for auto-refresh
- i18n for all strings
