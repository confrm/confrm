FROM alpine:3

RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    gcc musl-dev

COPY ./ /tmp/confrm
RUN cd /tmp/confrm && pip install ./ && cd / && rm -rf /tmp/confrm && mkdir /confrm
COPY ./default/config.toml /config.toml

EXPOSE 80

ENTRYPOINT confrm_srv --config /config.toml
