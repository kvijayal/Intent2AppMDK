export default function WorkOrders_Count(controlProxy) {
  return controlProxy.count('/SampleApp/Services/WorkOrderService.service', 'WorkOrders', '')
    .then(n => n + ' work orders').catch(() => '');
}