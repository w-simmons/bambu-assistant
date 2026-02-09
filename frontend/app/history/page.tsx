'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HistoryPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Print History</h1>

      <div className="text-center space-y-4 py-12">
        <span className="text-6xl">🦕</span>
        <h2 className="text-lg font-semibold">Coming Soon!</h2>
        <p className="text-muted-foreground">
          History will track your generated models once we add the database.
        </p>
        <p className="text-sm text-muted-foreground">
          For now, models are generated per-session only.
        </p>
        <Link href="/">
          <Button className="mt-4">
            ← Back to Chat
          </Button>
        </Link>
      </div>
    </div>
  );
}
