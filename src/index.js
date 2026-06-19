

STILO DENTAL

production


15

Agent















Confirma-o-clinica
Deployments
Variables
Metrics
Console
Settings
Unexposed service
22.22.3node@22.22.3
US West
1 Replica




History

Hide Skipped


Confirma-o-clinica
/
773fe093
Active

Jun 19, 2026, 2:44 PM GMT-3
Details
Build Logs
Deploy Logs
Network Flow Logs
Search build logs

You reached the start of the range
Jun 19, 2026, 2:39 PM
scheduling build on Metal builder "production-builderv3-us-west1-85z7"
unpacking archive
20 KB
1ms
uploading snapshot
3.8 KB
using build driver railpack-v0.29.0
 INFO No package manager inferred, using npm default
                   
╭─────────────────╮
│ Railpack 0.29.0 │
╰─────────────────╯
 
  ↳ Detected Node
  ↳ Custom start command detected, skipping Caddy start
  ↳ Custom start command detected, skipping Caddy start
  ↳ Custom start command detected, skipping Caddy start
  ↳ Using npm package manager
  ↳ Custom start command detected, skipping Caddy start
            
  Packages  
  ──────────
  node  │  22.22.3  │  railpack default (22)
            
  Steps     
  ──────────
  ▸ install
    $ npm install
            
  Deploy    
  ──────────
    $ npm run start
 

load build definition from ./railpack-plan.json
1ms

install apt packages: libatomic1
2s
Processing triggers for libc-bin (2.36-9+deb12u14) ...

install mise packages: node
2s
mise node@22.22.3 ✓ installed

mkdir -p /app/node_modules/.cache
265ms

copy package.json
354ms

npm install
1s
found 0 vulnerabilities

copy / /app
86ms

copy /app, /root/.cache, /app/node_modules, /etc/mise/config.toml, /usr/local/bin/mise, /mise/installs, /root/.local/state/mise, /mise/shims cached
201ms

exporting to docker image format
445ms
containerimage.descriptor: eyJtZWRpYVR5cGUiOiJhcHBsaWNhdGlvbi92bmQub2NpLmltYWdlLm1hbmlmZXN0LnYxK2pzb24iLCJkaWdlc3QiOiJzaGEyNTY6ZTI0MTM3NTE3ZGEzMzU5MThhMDRhYjM1ZjhhMjk3NjUwMmMxZWZlNTVhNDZmYTJiNTVjNjVkOTBiODNjNGQ4OCIsInNpemUiOjIzODIsImFubm90YXRpb25zIjp7Im9yZy5vcGVuY29udGFpbmVycy5pbWFnZS5jcmVhdGVkIjoiMjAyNi0wNi0xOVQxNzo0NDo0M1oifSwicGxhdGZvcm0iOnsiYXJjaGl0ZWN0dXJlIjoiYW1kNjQiLCJvcyI6ImxpbnV4In19
containerimage.config.digest: sha256:5e459103a710d29f003c8d9baf8ef3482070216df85362f89e79b0bd0727facd
containerimage.digest: sha256:e24137517da335918a04ab35f8a2976502c1efe55a46fa2b55c65d90b83c4d88
image push
118.5 MB
7.4s
You reached the end of the range
Jun 19, 2026, 2:49 PM


