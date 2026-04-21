"use client";

import type { FormValues } from "@/lib/form-schema";
import type { PreviewKind } from "@/lib/dengage-registry";
import EmailPreview from "./EmailPreview";
import TemplateListPreview from "./TemplateListPreview";
import DeliveryReportPreview from "./DeliveryReportPreview";
import ContactUpsertPreview from "./ContactUpsertPreview";
import JsonPreview from "./JsonPreview";

export type SendResult = { ok: boolean; status: number; responseBody: unknown } | null;

export default function Preview({
  kind,
  values,
  sendResult,
}: {
  kind: PreviewKind | undefined;
  values: FormValues;
  sendResult: SendResult;
}) {
  switch (kind) {
    case "email":
      return <EmailPreview values={values} sendResult={sendResult} />;
    case "template-list":
      return <TemplateListPreview sendResult={sendResult} />;
    case "delivery-report":
      return <DeliveryReportPreview sendResult={sendResult} />;
    case "contact-upsert":
      return <ContactUpsertPreview values={values} sendResult={sendResult} />;
    case "json":
    default:
      return <JsonPreview sendResult={sendResult} />;
  }
}
