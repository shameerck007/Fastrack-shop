import { LegalPageShell, LegalSection } from "@/components/LegalPageShell";
import type { CompanySettings } from "@/lib/company-settings";

// DRAFT for the India market. Written against the Digital Personal Data Protection Act, 2023 and the Information
// Technology Act, 2000. An Indian advocate should review it before launch; it is not legal advice.

const TOC = [
  { id: "scope", label: "1. What this notice covers" },
  { id: "information-we-collect", label: "2. Information we collect" },
  { id: "how-we-use", label: "3. How and why we use your information" },
  { id: "consent", label: "4. Your consent" },
  { id: "location", label: "5. Location information" },
  { id: "cookies", label: "6. Cookies & similar technologies" },
  { id: "notifications", label: "7. Notifications" },
  { id: "sharing", label: "8. Who we share information with" },
  { id: "transfers", label: "9. Where your information is processed" },
  { id: "security", label: "10. How we secure your information" },
  { id: "retention", label: "11. How long we keep it" },
  { id: "your-rights", label: "12. Your rights" },
  { id: "children", label: "13. Children" },
  { id: "changes", label: "14. Changes to this notice" },
  { id: "contact", label: "15. Grievance Officer & contact" },
];

export default function IndiaPrivacy({ company }: { company: CompanySettings }) {
  const name = company.trading_name;
  const contact = [company.email && `email ${company.email}`, company.phone && `phone ${company.phone}`].filter(Boolean).join(" or ");

  return (
    <LegalPageShell
      title="Privacy Notice"
      effectiveDate="September 30, 2026"
      intro={`This Privacy Notice explains how ${name} ("FasTrack", "we", "us") collects, uses and protects your personal data when you use the FasTrack Shop website and app in India, in line with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.`}
      toc={TOC}
    >
      <LegalSection id="scope" heading="1. What this notice covers">
        <p>
          It applies to personal data we collect through FasTrack when you browse products, create an account, place an
          order, contact support, or deal with sellers and delivery partners through the platform. For this purpose {name}{" "}
          is the Data Fiduciary.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" heading="2. Information we collect">
        <ul className="list-disc space-y-1 ps-5">
          <li>
            <span className="font-medium text-neutral-800">Account information:</span> your name, mobile number, email
            address and password.
          </li>
          <li>
            <span className="font-medium text-neutral-800">Order and delivery information:</span> delivery addresses
            (including flat, area, landmark, city, state and PIN code), order history and delivery notes.
          </li>
          <li>
            <span className="font-medium text-neutral-800">Location:</span> the coordinates of your delivery addresses
            and, if you allow it, your device&apos;s live location to place a pin accurately and route riders.
          </li>
          <li>
            <span className="font-medium text-neutral-800">Payment information:</span> for Cash on Delivery we record
            order totals and payment status. We do not collect or store card, UPI or bank details from customers.
          </li>
          <li>
            <span className="font-medium text-neutral-800">Content you submit:</span> reviews, ratings and support or
            chat messages about your orders.
          </li>
          <li>
            <span className="font-medium text-neutral-800">Device and usage information:</span> IP address, browser or
            app version and push-notification details, collected automatically.
          </li>
        </ul>
        <p>
          Sellers and riders who join FasTrack also give business and identity details (such as GSTIN, PAN, FSSAI licence,
          driving licence, Aadhaar or other ID, and bank account details) for verification and payouts. These are kept
          confidential and used only for those purposes.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" heading="3. How and why we use your information">
        <ul className="list-disc space-y-1 ps-5">
          <li>To create and manage your account and to process, deliver and invoice your orders.</li>
          <li>To pass your order to the right seller and assign a delivery partner.</li>
          <li>To send order confirmations, delivery updates and GST invoices by email, SMS or push notification.</li>
          <li>To answer support requests and handle refunds, disputes and delivery problems.</li>
          <li>To detect and prevent fraud, abuse and breaches of our Conditions of Use.</li>
          <li>To improve our catalogue, delivery coverage and service.</li>
          <li>To meet legal, tax and accounting duties, including GST invoicing and record-keeping.</li>
        </ul>
        <p>We use your data only for these purposes and do not sell it.</p>
      </LegalSection>

      <LegalSection id="consent" heading="4. Your consent">
        <p>
          We ask for your consent, in clear and plain language, before processing your personal data for the purposes
          above, except where the law lets us process it without consent (for example, to comply with a legal obligation
          or to deliver the order you asked for). You can withdraw consent at any time from your account settings or by
          contacting us. Withdrawing does not affect processing done before, and it may mean we can no longer serve you.
        </p>
      </LegalSection>

      <LegalSection id="location" heading="5. Location information">
        <p>
          We use the coordinates of your saved addresses to decide which seller can deliver to you, to set delivery areas
          and charges, and to give riders accurate pickup and drop-off points. You can manage or delete saved addresses
          any time from your account, and you can turn off device location in your browser or phone settings.
        </p>
      </LegalSection>

      <LegalSection id="cookies" heading="6. Cookies & similar technologies">
        <p>
          We use essential cookies and local storage to keep you signed in, remember your cart, delivery address and
          chosen country, and understand basic use of FasTrack. We do not use them to sell your information.
        </p>
      </LegalSection>

      <LegalSection id="notifications" heading="7. Notifications">
        <p>
          If you allow them, we send push notifications about order status, delivery arrival and important account alerts.
          You can switch them off at any time in your browser or device settings.
        </p>
      </LegalSection>

      <LegalSection id="sharing" heading="8. Who we share information with">
        <p>
          To fulfil your order we share what is needed (your name, delivery address, phone number and order contents) with
          the seller preparing it and the delivery partner carrying it. They may use it only to complete your order.
        </p>
        <p>
          We also use service providers who process data on our behalf under contract, such as cloud hosting, maps and
          routing, email and SMS delivery. We may disclose information to the government or a court where the law requires.
          We do not sell your personal data.
        </p>
      </LegalSection>

      <LegalSection id="transfers" heading="9. Where your information is processed">
        <p>
          Our service providers may store or process data on servers inside or outside India. We transfer personal data
          outside India only to the extent the Digital Personal Data Protection Act, 2023 permits and with appropriate
          safeguards.
        </p>
      </LegalSection>

      <LegalSection id="security" heading="10. How we secure your information">
        <p>
          We use access controls, encryption in transit and role-based access (for example, a seller sees only their own
          orders and products). No system is completely secure, but we work to protect your data with reasonable security
          safeguards. If a personal data breach affects you, we will tell you and the Data Protection Board of India as
          the law requires.
        </p>
      </LegalSection>

      <LegalSection id="retention" heading="11. How long we keep it">
        <p>
          We keep account and order information while your account is active and afterwards only as long as needed to meet
          legal, tax and accounting duties (including GST and income-tax records), settle disputes and enforce our
          agreements. When the purpose has ended and no law requires us to keep it, we delete it.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" heading="12. Your rights">
        <p>Under the Digital Personal Data Protection Act, 2023 you have the right to:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>get a summary of the personal data we hold about you and how we process it;</li>
          <li>have inaccurate or incomplete data corrected and out-of-date data updated;</li>
          <li>have your data erased when it is no longer needed, unless the law requires us to keep it;</li>
          <li>withdraw your consent at any time;</li>
          <li>have your grievance answered by us (see Section 15);</li>
          <li>nominate another person to exercise your rights if you die or become unable to.</li>
        </ul>
        <p>
          You can use most of these rights from your account settings, or by contacting us as set out in Section 15. If you
          are not satisfied with our reply, you may complain to the Data Protection Board of India.
        </p>
      </LegalSection>

      <LegalSection id="children" heading="13. Children">
        <p>
          FasTrack is not meant for children under 18. We do not knowingly collect a child&apos;s personal data without
          verifiable consent from a parent or lawful guardian, and we do not track or target children with advertising. If
          you believe a child has given us data, contact us and we will remove it.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="14. Changes to this notice">
        <p>
          We may update this notice for legal reasons or when our practices change. Changes take effect when posted here
          with the &quot;Effective&quot; date updated, and we will ask for fresh consent where the law requires it.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="15. Grievance Officer & contact">
        <p>
          For questions about this notice, to use your data rights, or to make a complaint, contact the Grievance Officer,
          {` ${name}`}
          {contact ? `, by ${contact}` : ""}.
          {company.address_line || company.city
            ? ` Our registered address: ${[company.address_line, company.city, company.state].filter(Boolean).join(", ")}.`
            : ""}{" "}
          We acknowledge complaints within 48 hours and resolve them within one month.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
