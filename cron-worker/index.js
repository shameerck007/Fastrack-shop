// Runs every minute (see wrangler.jsonc) and nudges the shop's quick-delivery dispatch: expires old rider offers, offers waiting
// Express orders to the next nearest rider and alerts admins about orders nobody could take.
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.SHOP_URL}/api/cron/dispatch`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }).then(async (res) => {
        if (!res.ok) console.log("dispatch sweep failed", res.status, await res.text());
      })
    );
  },
};
