import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";
import type { CompanySettings } from "@/lib/company-settings";

// DRAFT for the India market. Written against the Consumer Protection Act 2019, the Consumer Protection
// (E-Commerce) Rules 2020, the Information Technology Act 2000 and GST law. An Indian advocate should review it
// before launch; it is not legal advice.

const TOC = [
  { id: "agreement", label: "1. Agreement to these conditions" },
  { id: "eligibility", label: "2. Eligibility" },
  { id: "electronic-communications", label: "3. Electronic communications" },
  { id: "your-account", label: "4. Your account" },
  { id: "orders-payment", label: "5. Orders & payment" },
  { id: "pricing", label: "6. Prices, GST & invoices" },
  { id: "several-sellers", label: "7. Orders with more than one seller" },
  { id: "delivery", label: "8. Delivery" },
  { id: "cancellations-returns", label: "9. Cancellations, returns & refunds" },
  { id: "content-you-submit", label: "10. Ratings, reviews & content you submit" },
  { id: "marketplace-sellers", label: "11. Sellers on FasTrack" },
  { id: "food-safety", label: "12. Food safety" },
  { id: "delivery-partners", label: "13. Delivery partners" },
  { id: "prohibited-uses", label: "14. Prohibited uses" },
  { id: "intellectual-property", label: "15. Intellectual property" },
  { id: "disclaimer", label: "16. Disclaimer & limitation of liability" },
  { id: "grievance", label: "17. Grievance redressal" },
  { id: "governing-law", label: "18. Governing law & disputes" },
  { id: "changes", label: "19. Changes to these conditions" },
  { id: "contact", label: "20. Contact us" },
];

export default function IndiaTerms({ company }: { company: CompanySettings }) {
  const name = company.trading_name;
  const place = company.city ?? "the city of our registered office";
  const contact = [company.email && `email ${company.email}`, company.phone && `phone ${company.phone}`].filter(Boolean).join(" or ");

  return (
    <LegalPageShell
      title="Conditions of Use"
      effectiveDate="September 30, 2026"
      intro={`These Conditions of Use govern your access to and use of the FasTrack Shop website, mobile apps and related services (together, "FasTrack") operated by ${name} in India. By placing an order or otherwise using FasTrack, you agree to these conditions. This is an electronic record under the Information Technology Act, 2000 and needs no physical or digital signature.`}
      toc={TOC}
    >
      <LegalSection id="agreement" heading="1. Agreement to these conditions">
        <p>
          These Conditions of Use, together with our Privacy Notice and the policies referred to here, form the agreement
          between you and {name} about your use of FasTrack. If you do not agree with any part of them, please do not use
          FasTrack.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" heading="2. Eligibility">
        <p>
          You must be at least 18 years old and capable of entering into a legally binding contract under the Indian
          Contract Act, 1872 to create an account or place an order. A person under 18 may use FasTrack only through a
          parent or legal guardian&apos;s account and with their supervision.
        </p>
      </LegalSection>

      <LegalSection id="electronic-communications" heading="3. Electronic communications">
        <p>
          When you use FasTrack or send us emails, SMS, WhatsApp messages or push notifications, you communicate with us
          electronically and consent to receive communications from us the same way, including order confirmations,
          delivery updates, tax invoices and service announcements. Promotional messages are sent only with your consent,
          and you can withdraw it at any time from your account settings.
        </p>
      </LegalSection>

      <LegalSection id="your-account" heading="4. Your account">
        <p>
          To place an order you need an account with an accurate name, mobile number and delivery address. You are
          responsible for keeping your login details confidential and for everything done through your account. Tell us
          immediately if you suspect unauthorised use. We may suspend or close accounts that give false information, are
          used fraudulently or breach these conditions.
        </p>
      </LegalSection>

      <LegalSection id="orders-payment" heading="5. Orders & payment">
        <p>
          Placing an order is an offer to buy the products in your cart. We or the seller may accept or decline it for
          reasons such as the product being unavailable, a pricing or listing error, an address we cannot serve or
          suspected fraud. An order is confirmed only when you receive an order confirmation.
        </p>
        <p>
          FasTrack currently accepts Cash on Delivery only. Payment is due in full, in Indian rupees, to the delivery
          partner when your order is handed over. Other payment methods may be added later and will be shown at checkout.
        </p>
      </LegalSection>

      <LegalSection id="pricing" heading="6. Prices, GST & invoices">
        <p>
          All prices are in Indian rupees (₹) and are inclusive of Goods and Services Tax (GST) at the rate that applies
          to the product, unless stated otherwise. A delivery charge, where it applies, is also inclusive of GST. The price
          shown at checkout is the price you pay; nothing is added at the door.
        </p>
        <p>
          A tax invoice showing the seller&apos;s name, GSTIN, the product&apos;s HSN code, the GST rate and the CGST and
          SGST or IGST amount is available for each order in your order history. Availability and prices can change without
          notice until you place the order.
        </p>
      </LegalSection>

      <LegalSection id="several-sellers" heading="7. Orders with more than one seller">
        <p>
          When your cart has products from more than one shop, we place a separate order for each shop. Each order is
          packed, delivered and invoiced by that shop, can reach you at a different time, and carries its own delivery
          charge. You will see how your cart is split at checkout before you confirm.
        </p>
      </LegalSection>

      <LegalSection id="delivery" heading="8. Delivery">
        <p>
          We deliver within the areas served by our partner shops and warehouses. Delivery times shown at checkout are
          estimates and can be affected by traffic, weather, order volume or the accuracy of your address and location pin.
          You are responsible for giving an accurate address and being reasonably available to receive the order. The
          delivery partner may ask for the delivery code shown in your order before handing over the parcel.
        </p>
        <p>
          Ownership of and risk in the products pass to you when they are delivered to the address you gave, or to a
          person you have authorised to receive them.
        </p>
      </LegalSection>

      <LegalSection id="cancellations-returns" heading="9. Cancellations, returns & refunds">
        <p>
          You can cancel an order from your order page before it has been prepared or dispatched. Once it is out for
          delivery, cancellation may no longer be possible.
        </p>
        <p>
          Many products on FasTrack are perishable (fresh produce, fish, meat, dairy and bakery items) and cannot be
          returned once delivered, except where an item is damaged, spoiled, expired, incorrect or missing. If that happens,
          contact us promptly, ideally within 24 hours of delivery and with a photo, and we will arrange a replacement or a
          refund. Refunds are paid back to you by the means we agree with you and are shown on your order&apos;s payment
          status. Sealed, non-perishable items may be returned as described on the order page where the product is eligible.
        </p>
      </LegalSection>

      <LegalSection id="content-you-submit" heading="10. Ratings, reviews & content you submit">
        <p>
          If you submit a review, rating or other content, you give {name} a non-exclusive, royalty-free, worldwide licence
          to use, display and distribute it in connection with FasTrack. You confirm it is truthful, not misleading and does
          not infringe anyone&apos;s rights. We may remove content that breaks these conditions or that is abusive or
          unlawful.
        </p>
      </LegalSection>

      <LegalSection id="marketplace-sellers" heading="11. Sellers on FasTrack">
        <p>
          Most products are sold and fulfilled by independent, approved sellers, not by {name}. For these orders the
          seller&apos;s name, address, GSTIN and, for food, FSSAI licence number appear on the invoice as the seller of
          record. The seller is responsible for the product&apos;s accuracy, quality, quantity, price, expiry and legality.
        </p>
        <p>
          {name} provides the marketplace, order handling, delivery logistics and cash collection. In these roles we act as
          an intermediary and e-commerce marketplace entity under the Information Technology Act, 2000 and the Consumer
          Protection (E-Commerce) Rules, 2020, and we are not the manufacturer or, for marketplace orders, the seller of
          the product.
        </p>
      </LegalSection>

      <LegalSection id="food-safety" heading="12. Food safety">
        <p>
          Sellers of food must hold a valid Food Safety and Standards Authority of India (FSSAI) licence or registration and
          comply with the Food Safety and Standards Act, 2006. Check the best-before date and packaging on delivery. If you
          find a food-safety problem, do not consume the product and contact us straight away.
        </p>
      </LegalSection>

      <LegalSection id="delivery-partners" heading="13. Delivery partners">
        <p>
          Orders are delivered by FasTrack riders or affiliated delivery partners. Please treat them respectfully and give
          a safe, accessible place for delivery. They cannot accept returns or make commitments for FasTrack beyond handing
          over your order and collecting Cash on Delivery payment.
        </p>
      </LegalSection>

      <LegalSection id="prohibited-uses" heading="14. Prohibited uses">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>use FasTrack for any unlawful purpose or in breach of these conditions;</li>
          <li>try to gain unauthorised access to FasTrack, other accounts or our systems;</li>
          <li>interfere with or disrupt FasTrack or the networks connected to it;</li>
          <li>give false order information, place fraudulent orders or abuse offers and refunds;</li>
          <li>scrape, resell or copy FasTrack content or listings without our written permission.</li>
        </ul>
      </LegalSection>

      <LegalSection id="intellectual-property" heading="15. Intellectual property">
        <p>
          The FasTrack name, logo, website and app designs, text, graphics and software belong to {name} or its licensors
          and are protected by Indian and international law. Nothing here lets you use our trademarks or branding without
          our prior written consent.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" heading="16. Disclaimer & limitation of liability">
        <p>
          To the extent the law allows, FasTrack is provided &quot;as is&quot; and &quot;as available&quot;, and we do not
          give warranties beyond those that cannot be excluded under the Consumer Protection Act, 2019 or other applicable
          law. To the extent the law allows, {name} is not liable for indirect or consequential loss, and our total
          liability for a claim about an order will not exceed the amount you paid for that order. Nothing in these
          conditions limits your rights as a consumer under Indian law.
        </p>
      </LegalSection>

      <LegalSection id="grievance" heading="17. Grievance redressal">
        <p>
          In line with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, our
          Grievance Officer handles complaints about orders, sellers, content and these conditions. Write to the Grievance
          Officer, {name}{contact ? `, by ${contact}` : ""}. We acknowledge a complaint within 48 hours and resolve it within
          one month of receiving it.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" heading="18. Governing law & disputes">
        <p>
          These conditions are governed by the laws of India. Subject to your rights as a consumer to approach the
          Consumer Disputes Redressal Commission that has jurisdiction over you, the courts at {place}, India have
          jurisdiction over disputes about these conditions or your use of FasTrack.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="19. Changes to these conditions">
        <p>
          We may update these conditions from time to time. Changes take effect when posted on this page with the
          &quot;Effective&quot; date updated. If you keep using FasTrack after that, you accept the revised conditions.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="20. Contact us">
        <p>
          For questions about these conditions, contact {name}
          {company.email ? ` at ${company.email}` : ""}
          {company.phone ? ` or by phone at ${company.phone}` : ""}.
          {company.address_line || company.city
            ? ` Our registered address: ${[company.address_line, company.city, company.state].filter(Boolean).join(", ")}.`
            : ""}
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
