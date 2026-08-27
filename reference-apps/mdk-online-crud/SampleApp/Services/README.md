# Services

This reference app uses the SAP ESPM OData Service available in SAP Mobile Services.

To generate .service.metadata:
1. Run: cf login --sso
2. VS Code → Cmd+Shift+P → "MDK: Open Mobile App Editor"
3. Select your Mobile Services app → select ESPM destination → "Add App to Project"

Or use mdk_fetch_mobile_metadata tool:
  appId: <your-mobile-services-app-id>
  destination: com.sap.edm.sampleservice.v4
