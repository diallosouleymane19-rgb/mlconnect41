'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginAction({ email, password }: { email: string; password: string }) {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    redirect('/transporteur/dashboard')
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function logoutAction() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/')
}
