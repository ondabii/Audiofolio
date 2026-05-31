import ClientProjectPage from "./ClientPage";

export function generateStaticParams() {
  return [{ alias: "bias" }, { alias: "todomeory" }];
}

export default function ProjectPage() {
  return <ClientProjectPage />;
}
