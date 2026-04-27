-- Tornar o bucket "obra-anexos" publico (URL direta sem assinatura).
-- MVP: paths usam UUIDs, suficientemente seguros pra beta fechado.
-- Producao: voltar pra private + signed URLs.

update storage.buckets set public = true where id = 'obra-anexos';
