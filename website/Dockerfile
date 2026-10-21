# Mirentia landing — custom nginx image.
#
# Why a Dockerfile instead of `nginx:alpine` with two bind mounts:
#
# 1. /etc/nginx/conf.d/default.conf is a SYMLINK to /etc/nginx/nginx.conf in
#    the official image, so bind-mounting a file over it fails with
#    "cannot create subdirectories ... not a directory". Baking the config
#    in avoids the mount entirely.
# 2. Baking the site means Dokploy only needs the git repo — no volume, no
#    separate static-upload step.
#
# Build context must be `website/` (the directory holding this file).

FROM nginx:1.27-alpine

# /etc/nginx/conf.d/default.conf is a SYMLINK to /etc/nginx/nginx.conf in
# the official image. Both a bind mount AND a plain COPY fail on it
# ("cannot copy to non-directory"), because the copy resolves the symlink
# and lands on a path that is not a directory. Removing the symlink first
# makes the destination a real file again.
RUN rm -f /etc/nginx/conf.d/default.conf

# The site config is a TEMPLATE, not a plain .conf. The nginx entrypoint
# runs envsubst over /etc/nginx/templates/*.template at boot and writes
# the rendered result into /etc/nginx/conf.d/, substituting only the
# variables that exist in the container environment. That is the supported
# way to get $API_UPSTREAM into proxy_pass.
COPY docker-nginx.conf.template /etc/nginx/templates/landing.conf.template

COPY . /usr/share/nginx/html

# The compose file and Dockerfile have no business being world-readable.
RUN rm -f /usr/share/nginx/html/Dockerfile \
           /usr/share/nginx/html/docker-compose.yml \
           /usr/share/nginx/html/.dockerignore \
           /usr/share/nginx/html/docker-nginx.conf.template