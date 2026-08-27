export default function WorkOrders_StatusColor(clientAPI) {
  switch (clientAPI.binding.Status) {
    case 'Open':        return '#107E3E';
    case 'InProgress':  return '#E9730C';
    case 'Completed':   return '#0070F2';
    case 'Closed':      return '#6A6D70';
    default:            return '#BB0000';
  }
}