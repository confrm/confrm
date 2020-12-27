FROM alpine:3

RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    gcc musl-dev

RUN pip install git+https://github.com/confrm/confrm.git && mkdir /confrm
RUN cp ./default/config.toml /config.toml

EXPOSE 80

ENTRYPOINT confrm_srv --config /config.toml
