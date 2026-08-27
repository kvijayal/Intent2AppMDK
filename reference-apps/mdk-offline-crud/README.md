# mdk-offline-crud

Offline-capable CRUD MDK reference app — field service work order management.
Demonstrates the full offline OData pattern: Initialize → Download → Upload → CRUD.

**Source:** SAP-samples/cloud-mdk-tutorial-samples (Apache-2.0)
Adapted from: 4-Level-Up-with-the-mobile-development-kit

## Key patterns demonstrated
- Offline Initialize with filtered DefiningRequests (open/in-progress orders only)
- UploadOfflineOData wired before every Create/Update/Delete via CheckRequiredFields
- DownloadOfflineOData chained after every Upload success
- ShowActivityIndicator:true on all sync actions
- Sync button in ActionBar for manual refresh
- Barcode scanner on list page search
- ListPicker with static items rule (Priority)
- DatePicker for DueDate field
- StatusColor rule using SAP semantic colors

## OData Service
Requires a WorkOrder OData service with entity set: WorkOrders, Technicians
Configure via VS Code MDK extension or mdk_fetch_mobile_metadata tool.

## How to Use
Copied by mdk_create (scope: project, templateType: crud, offline: true)

1. Generate .service.metadata
2. Replace placeholder service with your real WorkOrder service
3. Update DefiningRequests query filters to match your data model
4. Validate: npx @sap/mdk-tools validate --project .
5. Deploy: npx @sap/mdk-tools deploy --target mobile --showqr --project .
