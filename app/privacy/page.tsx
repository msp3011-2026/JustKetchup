export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1C1917] mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#A8A29E] mb-8">Last updated: October 2026</p>

      <div className="space-y-6 text-sm text-[#44403C] leading-relaxed">
        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">What JustKetchup is</h2>
          <p>JustKetchup reminds you to catch up with people you care about, finds times you&apos;re free, and suggests places to meet halfway between you and a friend.</p>
        </section>

        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">What we collect</h2>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Your name, email and city, from Google sign-in and what you enter</li>
            <li>The contacts you choose to add (name, phone number, how often to catch up)</li>
            <li>Your free/busy times from Google Calendar, used only to suggest times</li>
            <li>For friends who open an invite: their neighborhood and food preferences, so they aren&apos;t asked again</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">Google Calendar</h2>
          <p>With your permission, JustKetchup reads when you&apos;re busy (not what your events are) to suggest free times, and adds confirmed meetups to your calendar. You can revoke access at any time in your Google Account settings.</p>
        </section>

        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">Messages</h2>
          <p>JustKetchup does not send text messages. Invites are sent by you, from your own WhatsApp.</p>
        </section>

        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">Who we share it with</h2>
          <p>Nobody, except the services that run the app: Supabase (database and sign-in), Vercel (hosting) and Google (calendar and place suggestions). We never sell your data.</p>
        </section>

        <section>
          <h2 className="font-semibold text-[#1C1917] mb-2">Deleting your data</h2>
          <p>Email manasi.iit.madras@gmail.com and we&apos;ll delete your account and everything linked to it.</p>
        </section>
      </div>
    </main>
  )
}
