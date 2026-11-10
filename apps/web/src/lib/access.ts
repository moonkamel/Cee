import 'server-only';
import { type Access, accessFromSql } from '@preuvio/shared';
import { cache } from 'react';
import { supabaseServer } from './supabase/server';

/** Accès de l'entreprise de l'utilisateur, lu une fois par requête. */
export const companyAccess = cache(async (): Promise<Access> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('my_company_access');
  return accessFromSql(data);
});
