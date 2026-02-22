// MIT Licence — AI CFO Wallet — Buypath Ltd
// Root redirect to dashboard

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}
