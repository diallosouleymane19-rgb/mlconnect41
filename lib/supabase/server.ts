import { createServerClient } from '@supabase/ssr';
import { cookies as getCookies } from 'next/headers';

export function createClient() {
  const cookieStore = getCookies() as any; // Type assertion pour éviter les warnings TypeScript

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently ignore errors in certain SSR scenarios
          }
        },
      },
    }
  );
}
