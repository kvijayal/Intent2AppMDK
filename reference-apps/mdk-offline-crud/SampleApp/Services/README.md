# Services

Generate .service.metadata via VS Code MDK extension or mdk_fetch_mobile_metadata.
This app uses a WorkOrder OData service backend.

DefiningRequests (in InitializeOfflineOData):
- OpenWorkOrders: WorkOrders?$filter=Status eq 'Open' or Status eq 'InProgress'
- Technicians: Technicians
