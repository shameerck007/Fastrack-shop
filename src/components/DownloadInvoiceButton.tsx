export default function DownloadInvoiceButton({ orderId }: { orderId: string }) {
  return (
    <a
      href={`/api/orders/${orderId}/invoice`}
      download
      className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
    >
      📄 Download Invoice
    </a>
  );
}
