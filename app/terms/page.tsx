export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1C1917] mb-2">Terms of Use</h1>
      <p className="text-sm text-[#A8A29E] mb-8">Last updated: October 2026</p>

      <div className="space-y-6 text-sm text-[#44403C] leading-relaxed">
        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">Using JustKetchup</h2>
          <p>JustKetchup is in private beta. Use it to make plans with people you know, and only add contacts you have a real relationship with.</p>
        </section>
        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">Places and bookings</h2>
          <p>Venue suggestions come from Google. JustKetchup doesn&apos;t make reservations, and we can&apos;t guarantee a place is open or has space.</p>
        </section>
        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">The beta</h2>
          <p>The app is provided as-is while in beta. We may change, pause or stop it at any time.</p>
        </section>
      </div>
    </main>
  )
}
