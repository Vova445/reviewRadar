"use client";

import * as Sentry from "@sentry/browser";

const dsn=process.env.NEXT_PUBLIC_SENTRY_DSN;
if(typeof window!=="undefined"&&dsn){
  Sentry.init({
    dsn,
    tracesSampleRate:0,
    beforeBreadcrumb:()=>null,
    beforeSend(event){
      event.user=undefined;event.request=undefined;event.breadcrumbs=undefined;event.extra=undefined;
      if(event.exception?.values)for(const item of event.exception.values)if(item.value)item.value=item.value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[REDACTED_EMAIL]").replace(/(?:ya29\.|1\/\/0)[A-Z0-9._~-]+/g,"[REDACTED_TOKEN]").replace(/Bearer\s+[A-Z0-9._~+/=-]+/gi,"Bearer [REDACTED_TOKEN]").replace(/eyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}/g,"[REDACTED_TOKEN]");
      return event;
    },
  });
}

export default function SentryClient(){return null;}
