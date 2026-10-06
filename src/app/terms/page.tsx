import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";
import { getCompanySettings } from "@/lib/company-settings";
import { getCurrentTenant } from "@/lib/tenant-server";
import IndiaTerms from "@/components/legal/IndiaTerms";

export const metadata = { title: "Conditions of Use — FasTrack Shop" };

const TOC = [
  { id: "agreement", label: "1. Agreement to these conditions" },
  { id: "electronic-communications", label: "2. Electronic communications" },
  { id: "your-account", label: "3. Your account" },
  { id: "orders-payment", label: "4. Orders & payment" },
  { id: "pricing", label: "5. Pricing & availability" },
  { id: "delivery", label: "6. Delivery" },
  { id: "cancellations-returns", label: "7. Cancellations, returns & refunds" },
  { id: "content-you-submit", label: "8. Ratings, reviews & content you submit" },
  { id: "marketplace-sellers", label: "9. Sellers on FasTrack" },
  { id: "delivery-partners", label: "10. Delivery partners" },
  { id: "prohibited-uses", label: "11. Prohibited uses" },
  { id: "intellectual-property", label: "12. Intellectual property" },
  { id: "disclaimer", label: "13. Disclaimer of warranties" },
  { id: "limitation-of-liability", label: "14. Limitation of liability" },
  { id: "indemnification", label: "15. Indemnification" },
  { id: "governing-law", label: "16. Governing law & disputes" },
  { id: "changes", label: "17. Changes to these conditions" },
  { id: "contact", label: "18. Contact us" },
];

export default async function TermsPage() {
  const company = await getCompanySettings();
  // The legal text follows the market being used: India has its own terms and privacy notice.
  if ((await getCurrentTenant())?.country_code === "IN") return <IndiaTerms company={company} />;

  return (
    <LegalPageShell
      title="Conditions of Use"
      effectiveDate="September 30, 2026"
      intro={`These Conditions of Use govern your access to and use of the FasTrack Shop website, mobile apps, and related services (together, "FasTrack") operated by ${company.trading_name}. By placing an order or otherwise using FasTrack, you agree to these conditions.`}
      toc={TOC}
    >
      <LegalSection id="agreement" heading="1. Agreement to these conditions">
        <p>
          Welcome to FasTrack Shop. These Conditions of Use, together with our Privacy Notice and any policies
          referenced here, form the entire agreement between you and {company.trading_name} regarding your use of
          FasTrack. If you do not agree with any part of these conditions, please do not use FasTrack.
        </p>
        <p>
          You must be at least 18 years old, or the age of legal majority in your jurisdiction, and capable of
          entering into a binding contract to create an account or place an order on FasTrack.
        </p>
      </LegalSection>

      <LegalSection id="electronic-communications" heading="2. Electronic communications">
        <p>
          When you use FasTrack or send us emails, SMS, WhatsApp messages, or push notifications, you are
          communicating with us electronically. You consent to receive communications from us electronically,
          including order confirmations, delivery updates, receipts, and service announcements. We may also send
          you promotional messages, which you can opt out of at any time from your account settings.
        </p>
      </LegalSection>

      <LegalSection id="your-account" heading="3. Your account">
        <p>
          To place an order, you need to create an account with an accurate name, phone number, and delivery
          address. You are responsible for maintaining the confidentiality of your account credentials and for all
          activity that occurs under your account. Notify us immediately if you suspect any unauthorized use of
          your account.
        </p>
        <p>
          We may suspend or close accounts that provide false information, are used fraudulently, or otherwise
          violate these conditions.
        </p>
      </LegalSection>

      <LegalSection id="orders-payment" heading="4. Orders & payment">
        <p>
          When you place an order, you are making an offer to buy the products in your cart. We may accept or
          decline your order for any reason, including product unavailability, errors in pricing or product
          information, or suspected fraud. An order is only confirmed once you receive an order confirmation.
        </p>
        <p>
          FasTrack currently accepts Cash on Delivery as the sole payment method. Payment is due in full to the
          delivery rider at the time your order is handed over. Additional payment methods may be introduced in the
          future and will be reflected at checkout.
        </p>
      </LegalSection>

      <LegalSection id="pricing" heading="5. Pricing & availability">
        <p>
          Displayed prices are inclusive of Value Added Tax (VAT) unless stated otherwise, and are shown in Saudi
          Riyals (SAR). Product availability, stock levels, and pricing may change without notice and can differ
          between FasTrack&apos;s own catalog and items sold by independent sellers on the platform (see Section 9).
        </p>
        <p>
          A tax invoice, including a ZATCA-compliant QR code, is generated for every completed order and is
          available for download from your order history.
        </p>
      </LegalSection>

      <LegalSection id="delivery" heading="6. Delivery">
        <p>
          We deliver within the zones covered by our warehouses and partner sellers. Estimated delivery times shown
          at checkout are approximate and may be affected by traffic, weather, order volume, or address accuracy.
          You are responsible for providing an accurate delivery address and for being reasonably available to
          receive your order.
        </p>
        <p>
          Risk of loss and title to products pass to you upon delivery to the address you provided, or to the
          person you have authorized to receive the order on your behalf.
        </p>
      </LegalSection>

      <LegalSection id="cancellations-returns" heading="7. Cancellations, returns & refunds">
        <p>
          You may cancel an order before it has been prepared or dispatched, from your order details page. Once an
          order is out for delivery, cancellation may no longer be possible.
        </p>
        <p>
          If an item you receive is damaged, incorrect, or missing, contact us promptly so we can arrange a refund
          or replacement. Refunds for Cash on Delivery orders are processed as store credit or a direct refund at
          our discretion, and are reflected on your order&apos;s payment status once approved.
        </p>
      </LegalSection>

      <LegalSection id="content-you-submit" heading="8. Ratings, reviews & content you submit">
        <p>
          If you submit a product review, seller rating, delivery rating, or other content, you grant
          {` ${company.trading_name} `}
          a non-exclusive, royalty-free, worldwide license to use, display, and distribute that content in
          connection with FasTrack. You are solely responsible for the content you submit and confirm it is
          truthful, not misleading, and does not infringe any third party&apos;s rights.
        </p>
        <p>
          We may remove any content that we reasonably believe violates these conditions, is abusive, or is
          otherwise inappropriate.
        </p>
      </LegalSection>

      <LegalSection id="marketplace-sellers" heading="9. Sellers on FasTrack">
        <p>
          Some products available on FasTrack are sold and fulfilled by independent, approved third-party sellers
          rather than by {company.trading_name} directly. Where this is the case, the seller&apos;s own trading name,
          Commercial Registration (CR) number, and VAT registration number appear as the seller of record on your
          invoice for that order, and that seller is responsible for the accuracy, quality, and legality of the
          products they list.
        </p>
        <p>
          {company.trading_name} facilitates the marketplace, payment collection, and delivery logistics for these
          orders, but is not the manufacturer or, in the case of marketplace orders, the legal seller of the
          product itself.
        </p>
      </LegalSection>

      <LegalSection id="delivery-partners" heading="10. Delivery partners">
        <p>
          Orders are delivered by FasTrack riders or affiliated delivery partners. You agree to treat delivery
          partners respectfully and to provide a safe and accessible location for delivery. Delivery partners are
          not authorized to accept returns or make commitments on FasTrack&apos;s behalf beyond handing over your
          order and collecting Cash on Delivery payment.
        </p>
      </LegalSection>

      <LegalSection id="prohibited-uses" heading="11. Prohibited uses">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>Use FasTrack for any unlawful purpose or in violation of these conditions.</li>
          <li>Attempt to gain unauthorized access to any part of FasTrack, other accounts, or our systems.</li>
          <li>Interfere with or disrupt the operation of FasTrack or the servers/networks connected to it.</li>
          <li>Submit false order information, place fraudulent orders, or abuse promotions and refunds.</li>
          <li>Scrape, resell, or reproduce FasTrack content or listings without our written permission.</li>
        </ul>
      </LegalSection>

      <LegalSection id="intellectual-property" heading="12. Intellectual property">
        <p>
          The FasTrack name, logo, website, and app designs, along with all text, graphics, and software used to
          operate FasTrack, are the property of {company.trading_name} or its licensors and are protected by
          applicable intellectual property laws. Nothing in these conditions grants you any right to use our
          trademarks or branding without our prior written consent.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" heading="13. Disclaimer of warranties">
        <p>
          FasTrack and all products and services made available through it are provided on an &quot;as is&quot; and
          &quot;as available&quot; basis. To the fullest extent permitted by law, we disclaim all warranties, express
          or implied, including implied warranties of merchantability, fitness for a particular purpose, and
          non-infringement, except where such warranties cannot be excluded under applicable Saudi law.
        </p>
      </LegalSection>

      <LegalSection id="limitation-of-liability" heading="14. Limitation of liability">
        <p>
          To the fullest extent permitted by applicable law, {company.trading_name} shall not be liable for any
          indirect, incidental, special, or consequential damages arising out of or in connection with your use of
          FasTrack. Our total liability for any claim arising from an order shall not exceed the amount you paid
          for that order.
        </p>
      </LegalSection>

      <LegalSection id="indemnification" heading="15. Indemnification">
        <p>
          You agree to indemnify and hold {company.trading_name}, its officers, employees, and affiliated sellers
          and delivery partners harmless from any claim or demand, including reasonable legal fees, arising out of
          your misuse of FasTrack or your violation of these conditions.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" heading="16. Governing law & disputes">
        <p>
          These conditions are governed by the laws of the Kingdom of Saudi Arabia. Any dispute arising out of or
          relating to these conditions or your use of FasTrack shall be subject to the exclusive jurisdiction of
          the competent courts of Saudi Arabia, without prejudice to any right you may have under applicable
          consumer protection law.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="17. Changes to these conditions">
        <p>
          We may update these Conditions of Use from time to time. Changes take effect once posted on this page,
          with the &quot;Effective&quot; date updated accordingly. Continuing to use FasTrack after changes are posted
          constitutes your acceptance of the revised conditions.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="18. Contact us">
        <p>
          If you have questions about these conditions, contact {company.trading_name}
          {company.email ? ` at ${company.email}` : ""}
          {company.phone ? ` or by phone at ${company.phone}` : ""}.
          {company.address_line || company.city
            ? ` Our registered address: ${[company.address_line, company.city].filter(Boolean).join(", ")}.`
            : ""}
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
