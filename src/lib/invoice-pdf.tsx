import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceData } from "@/lib/orders";
import { formatSAR, ORDER_STATUS_LABELS } from "@/lib/utils";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#171717", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 140 },
  invoiceTitle: { fontSize: 16, fontWeight: 700, textAlign: "right", color: "#1d4ed8" },
  meta: { fontSize: 9, color: "#525252", textAlign: "right", marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e5e5", marginVertical: 16 },
  columns: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  column: { width: "48%" },
  sectionLabel: { fontSize: 9, fontWeight: 700, color: "#737373", marginBottom: 4, textTransform: "uppercase" },
  line: { marginBottom: 2 },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  colProduct: { width: "46%" },
  colQty: { width: "14%", textAlign: "center" },
  colPrice: { width: "20%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d4",
  },
  grandTotalLabel: { fontWeight: 700, fontSize: 11 },
  grandTotalValue: { fontWeight: 700, fontSize: 11, color: "#1d4ed8" },
  footer: { marginTop: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qr: { width: 90, height: 90 },
  footerText: { fontSize: 8, color: "#a3a3a3", width: 320 },
});

export function InvoiceDocument({
  order,
  qrDataUrl,
  logoDataUrl,
}: {
  order: InvoiceData;
  qrDataUrl: string;
  logoDataUrl: string;
}) {
  const customerName = order.profiles?.full_name ?? "Customer";
  const address = order.addresses;
  const payment = order.payments[0];

  return (
    <Document title={`Invoice ${order.order_number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
          <Image src={logoDataUrl} style={styles.logo} />
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.meta}>Order #{order.order_number}</Text>
            <Text style={styles.meta}>{new Date(order.created_at).toLocaleString("en-SA")}</Text>
            <Text style={styles.meta}>Status: {ORDER_STATUS_LABELS[order.status] ?? order.status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Sold By</Text>
            <Text style={styles.line}>FasTrack Shop</Text>
            <Text style={styles.line}>Riyadh, Saudi Arabia</Text>
            <Text style={styles.line}>VAT Registration No: 300000000000003</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.line}>{customerName}</Text>
            {order.profiles?.phone && <Text style={styles.line}>{order.profiles.phone}</Text>}
            {address && (
              <Text style={styles.line}>
                {address.address_line}, {address.city}
              </Text>
            )}
            {payment && (
              <Text style={styles.line}>
                Payment: {payment.method.replace(/_/g, " ").toUpperCase()} ({payment.status})
              </Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colProduct}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {order.order_items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colProduct}>
                {item.product_name} ({item.variant_label})
              </Text>
              <Text style={styles.colQty}>{item.ordered_quantity}</Text>
              <Text style={styles.colPrice}>{formatSAR(item.unit_price)}</Text>
              <Text style={styles.colTotal}>{formatSAR(item.line_total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal (incl. VAT)</Text>
            <Text>{formatSAR(order.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>  of which VAT (15%)</Text>
            <Text>{formatSAR(order.vat)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Delivery fee</Text>
            <Text>{order.delivery_fee === 0 ? "Free" : formatSAR(order.delivery_fee)}</Text>
          </View>
          {order.discount > 0 && (
            <View style={styles.totalRow}>
              <Text>Discount</Text>
              <Text>-{formatSAR(order.discount)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatSAR(order.total)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
          <Image src={qrDataUrl} style={styles.qr} />
          <Text style={styles.footerText}>
            Scan to verify this simplified tax invoice per ZATCA e-invoicing regulations. Thank you for
            shopping with FasTrack Shop — everything you need, delivered.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
