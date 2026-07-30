/* Cliente Supabase do JPFFS.
 * As chaves abaixo são as PÚBLICAS (publishable) do projeto — podem ficar no
 * código do site sem risco, porque o banco está protegido por RLS: qualquer
 * pessoa pode ler, só organizadores logados podem gravar.
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://njwhdzntwzgoxcyhhwod.supabase.co";
const CHAVE_PUBLICA = "sb_publishable_ZMfWx3ZYt7RSGnEIIGX0ag_oMkB3set";

export const supabase = createClient(URL, CHAVE_PUBLICA);
