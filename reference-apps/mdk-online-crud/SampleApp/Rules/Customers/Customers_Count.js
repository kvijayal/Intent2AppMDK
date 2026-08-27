export default function Customers_Count(controlProxy) {
  return controlProxy.count('/SampleApp/Services/ESPM.service', 'Customers', '')
    .then(n => n + ' customers').catch(() => '');
}