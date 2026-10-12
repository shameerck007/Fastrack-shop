import RegisterForm from "@/components/RegisterForm";
import { getDefaultPhoneCountry } from "@/lib/get-request-country";

export const metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const defaultCountryCode = await getDefaultPhoneCountry();
  return <RegisterForm defaultCountryCode={defaultCountryCode} />;
}
