-- 0049 a public, read only home for the Harare PMTiles extract (CHECKS 15)
--
-- The extract is a generated 8 MB binary, git ignored by design, so it never
-- reached the deployment and the live map fell back to MapTiler. This bucket
-- serves it with HTTP range requests, which is all the self hosted provider
-- needs (NEXT_PUBLIC_MAP_PMTILES_URL points at the object).
--
-- Public read is the point: map tiles are OpenStreetMap derived open data and
-- carry no rider information. There is deliberately NO insert, update or
-- delete policy on storage.objects for this bucket, so only the service role
-- (the upload script, tools/map-tiles/upload-pmtiles.mjs) can write to it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('map', 'map', true, 26214400, array['application/octet-stream', 'application/vnd.pmtiles'])
on conflict (id) do nothing;
