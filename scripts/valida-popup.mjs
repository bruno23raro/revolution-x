#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const APP = process.env.APP ?? "https://revolutionx.com.br";
const EMAIL = "brunoalmeida23111996@gmail.com";
const PASSWORD = "B23b23v1814*";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const sbUrl = "https://nheelwshzbgenpavwhcy.supabase.co";
  const supabase = createClient(
    sbUrl,
    "sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd",
  );

  // Step 1: POST {APP}/api/auth/login
  console.log("Step 1: Login");
  const loginRes = await fetch(`${APP}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (loginRes.status !== 200) {
    console.error(`FAIL: Step 1 login returned ${loginRes.status}`);
    process.exit(1);
  }
  const loginCookie = loginRes.headers.get("set-cookie");
  if (!loginCookie) {
    console.error("FAIL: Step 1 no cookie received");
    process.exit(1);
  }
  console.log("  OK: login 200, cookie received");

  // Step 2: POST {APP}/api/integrations/openbsp/connect com cookie
  console.log("Step 2: OpenBSP connect");
  const connectRes = await fetch(`${APP}/api/integrations/openbsp/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: loginCookie,
    },
    body: JSON.stringify({}),
  });
  if (connectRes.status !== 200) {
    console.error(`FAIL: Step 2 connect returned ${connectRes.status}`);
    process.exit(1);
  }
  const connectData = await connectRes.json();
  const popupUrl = connectData.popupUrl;
  if (
    !popupUrl ||
    !popupUrl.startsWith("https://web.openbsp.dev/onboard/whatsapp/")
  ) {
    console.error(`FAIL: Step 2 popupUrl inválido: ${popupUrl}`);
    process.exit(1);
  }
  // Extract tokenId from popupUrl
  const tokenIdMatch = popupUrl.match(/\/onboard\/whatsapp\/([^/]+)$/);
  if (!tokenIdMatch) {
    console.error(`FAIL: Step 2 cannot extract tokenId from ${popupUrl}`);
    process.exit(1);
  }
  const tokenId = tokenIdMatch[1];
  console.log(`  OK: connect 200, popupUrl=${popupUrl}, tokenId=${tokenId}`);

  // Step 3: GET popupUrl
  console.log("Step 3: GET popupUrl");
  const popupGet = await fetch(popupUrl, {
    headers: { cookie: loginCookie },
  });
  if (popupGet.status !== 200) {
    console.error(`FAIL: Step 3 popup GET returned ${popupGet.status}`);
    process.exit(1);
  }
  const popupText = await popupGet.text();
  if (!popupText.includes("Connect your WhatsApp number")) {
    console.error(
      `FAIL: Step 3 popup text missing 'Connect your WhatsApp number'`,
    );
    process.exit(1);
  }
  console.log("  OK: popup 200, text includes Connect your WhatsApp number");

  // Step 4: GET https://nheelwshzbgenpavwhcy.supabase.co/functions/v1/whatsapp-management/onboard?token=<tokenId>
  console.log("Step 4: Supabase function onboard");
  const onboardRes = await fetch(
    `https://nheelwshzbgenpavwhcy.supabase.co/functions/v1/whatsapp-management/onboard?token=${tokenId}`,
    {
      headers: {
        Authorization: `Bearer sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd`,
      },
    },
  );
  if (onboardRes.status !== 200) {
    console.error(`FAIL: Step 4 onboard returned ${onboardRes.status}`);
    const onboardText = await onboardRes.text();
    console.error(`  body: ${onboardText.substring(0, 200)}`);
    process.exit(1);
  }
  const onboardData = await onboardRes.json();
  if (onboardData.valid !== true) {
    console.error(
      `FAIL: Step 4 valid !== true, got: ${JSON.stringify(onboardData)}`,
    );
    process.exit(1);
  }
  console.log("  OK: onboard valid=true");

  // Step 5: POST {APP}/api/integrations/openbsp/status com cookie
  console.log("Step 5: OpenBSP status");
  const statusRes = await fetch(`${APP}/api/integrations/openbsp/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: loginCookie,
    },
    body: JSON.stringify({}),
  });
  if (statusRes.status !== 200) {
    console.error(`FAIL: Step 5 status returned ${statusRes.status}`);
    process.exit(1);
  }
  const statusData = await statusRes.json();
  if (!["connected", "pending"].includes(statusData.status)) {
    console.error(
      `FAIL: Step 5 status not connected/pending, got: ${statusData.status} reason:${statusData.reason}`,
    );
    process.exit(1);
  }
  console.log(`  OK: status=${statusData.status}`);

  console.log("OK 1..5");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
