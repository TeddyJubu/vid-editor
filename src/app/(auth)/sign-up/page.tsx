"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <p className="text-sm text-muted-foreground">
          Get started with VidEditor in a minute.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setMessage(null);
            setSubmitting(true);
            try {
              const supabase = createClient();
              const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: { name },
                },
              });

              if (authError) {
                setError(authError.message);
                return;
              }

              if (data.session) {
                router.push("/dashboard");
                router.refresh();
                return;
              }

              setMessage("Account created. Check your email to confirm your address.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sign up failed");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
              autoComplete="new-password"
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
          {message ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
              {message}
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Already have an account?</span>
        <Link className="text-brand hover:underline" href="/sign-in">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
