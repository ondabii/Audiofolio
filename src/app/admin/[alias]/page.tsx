import ClientAdminPage from "./ClientAdminPage";

export function generateStaticParams() {
  return [{ alias: "bias" }, { alias: "todomeory" }];
}

export default function AdminProjectPage() {
  return <ClientAdminPage />;
}
