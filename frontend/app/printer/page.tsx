'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrinterPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Printer Status</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-2xl">🖨️</span>
            Bambu Lab A1 mini
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4 py-8">
            <span className="text-4xl">📡</span>
            <h2 className="text-lg font-semibold">Printer Bridge Required</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              The Python bridge needs to be running locally to connect to your printer via MQTT.
            </p>
            <div className="bg-muted rounded-lg p-4 text-left max-w-md mx-auto">
              <p className="text-sm font-medium mb-2">To start the bridge:</p>
              <code className="text-xs bg-background rounded px-2 py-1 block">
                cd bridge && python main.py
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Once running, this page will show live printer status and controls.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href="/">
          <Button variant="outline">
            ← Back to Chat
          </Button>
        </Link>
      </div>
    </div>
  );
}
