FROM node:6-slim 

ADD . /src/

WORKDIR /src/

RUN  npm install

ENTRYPOINT [ "/src/entrypoint.sh" ]

CMD [ ]
