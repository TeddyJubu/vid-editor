"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <p className="text-sm text-muted-foreground">
          Welcome back. Enter your details to continue.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSubmitting(true);
            try {
              const supabase = createClient();
              const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (authError) {
                setError(authError.message);
                return;
              }

              const redirectedFrom = searchParams.get("redirectedFrom");
              router.push(redirectedFrom && redirectedFrom.startsWith("/") ? redirectedFrom : "/dashboard");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sign in failed");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
              {error}
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Don&apos;t have an account?</span>
        <Link className="text-brand hover:underline" href="/sign-up">
          Sign up
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <SignInInner />
    </React.Suspense>
  );
}
