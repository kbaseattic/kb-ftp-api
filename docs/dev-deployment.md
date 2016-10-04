# Developer Deployment 

Following are notes for how I got the ftp api running, able to upload files,
and able to share the files per-globus-user.

Key to this is:

- using nodejs 6.6
- creating the shared data directory
- creating a globus test account with special "plus" powers
- create an endpoint
- 


## create vm

- ubuntu 14.04
- nodejs 6.6
  - install as per: https://github.com/nodesource/distributions

##  Clone the ftp api

- vagrant ssh
- cd /vagrant (or wherever)
- git clone https://github.com/kbase/kb-ftp-api


## create the ftp-api config

- create kb-ftp-api/config/env.json
- install node deps:
    - npm install
- add this:
{
    "deployment": "ci",
    "globusAuthToken": "",
    "globusTransferToken": ""
}


## create root data directory with rw access for the user who will be running it:

- mkdir /data/shared
- chmod 777 /data/shared

## create test account at globus

- create a new account at globus with an email address that routes to you
- have dan add it to kbase plus
    - this is required in order for it to conduct ACL modifications for other users

## create personal setup key at globus

- while logged in goto Manage Data > Endpoints
- select "+ add Globus Connect Personal endpoint"
- enter a display name, like "My test kbase bulk endpoint"
- a "Setup Key" will be generated
- keep this window open as you will need to copy it below

## install globus connect personal

- wget https://s3.amazonaws.com/connect.globusonline.org/linux/stable/globusconnectpersonal-latest.tgz
- copy the setup key to the clipboard
- run the client with the "setup" option
- ./globusconnect -setup <your key>

## create a sharing endopint

By default, the personal endpoint cannot be partitioned into folders shared with specific users.
In order to enable this, first the owner of the endpoint must be a plus users (see above).
Secondly, you must create a shared endpoint at the root of the primary endpoint
- while still logged in as the test user
- navigate to Manage Data > Endpoints
- select the endpoint you created
- select the My Shares tab
- there should be no shares showing
- Click "Add Shared Endpoint"
- Enter
  - Host Path: /data/bulk
     - this is the absolute path on the host (running globus connect personal)
  - Share Display Name: SOMETHING
     - this will be used to identify the shared endpoing both in the globus endpoint
       management tool, and also in in the user endpoint management tool when it 
       provides a searchable list of available endpoints
  - Click "Create"
- the globus endpoint tool will bring you to the shared endpoint on the Sharing tab
- select the Overview tab
- copy the value of the UUID field
- paste this into the "endpointId" property in the config/confg-ci.json

## start globus connect personal

- ./globusconnect -debug -restrict-paths "rw,/data/bulk" -shared-paths "rw,/data/bulk"
- this will run it in the foreground in chatty debug mode

## get tokens for accessing globus via the api:

- while still logged in to your test account
- visit tokens.globus.org
- get auth and transfer tokens for the test account
- copy these tokens into the appropriate fields in env.json

> Note: these tokens will work for two days. After two days you will need to 
  generate fresh tokens and install them.

## generate bulkio service token

Ah, the main point of this refactoring was to move the service token from the ui to the back end.
We generate the service token using the get-token.js script found in the kb-ftp-api root

- node get-token.js username password > tokens/bulkio-service-token.json

> Note: I've not been able to test this, since I didn't have access to the bulkio passowrd

## Start the ftp api server
cd /vagrant/kb-ftp-api
nodejs server.js

