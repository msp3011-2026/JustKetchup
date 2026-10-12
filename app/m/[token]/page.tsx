import InviteFlow from './InviteFlow';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'JustKetchup',
  description: "Let's catch up",
};

export default function InvitePage({ params }: { params: { token: string } }) {
  return <InviteFlow token={params.token} />;
}
