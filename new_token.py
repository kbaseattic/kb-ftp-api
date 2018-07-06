#!/usr/bin/env python2.7
#This needs to be placed in cron on the api host to keep the globus token refreshed

from __future__ import print_function # for python 2
from globus_sdk import TransferClient
from globus_sdk import AuthClient
from globus_sdk import TransferAPIError
import globus_sdk
import traceback
import argparse
import os
import pickle

CLIENT_ID = '26d64c4c-fcc2-4f7c-b056-62f185875af6' 
client = globus_sdk.NativeAppAuthClient(CLIENT_ID)

##########################
#If we ever need to re-request the refreshable tokens, uncomment this section and use the globus account with admin permissions 
# on the share to complete the web browser step.
##########################
client.oauth2_start_flow_native_app(refresh_tokens=True)

authorize_url = client.oauth2_get_authorize_url()
print('Please go to this URL and login: {0}'.format(authorize_url))

# this is to work on Python2 and Python3 -- you can just use raw_input() or
# input() for your specific version
get_input = getattr(__builtins__, 'raw_input', input)
auth_code = get_input(
    'Please enter the code you get after login here: ').strip()
token_response = client.oauth2_exchange_code_for_tokens(auth_code)
print(token_response)

#write token response to file for reading later
with open('/opt/kb-ftp-api/f', 'wb') as f:
    pickle.dump(token_response, f)

#read token from file
########################
# End refresh steps
#######################

#open the globus cfg file for writing
from ConfigParser import SafeConfigParser

parser = SafeConfigParser()
parser.read('/root/.globus.cfg')
#general.auth_token general.transfer_token

# The refresh token is stored in this file..  protect this file
with open('/opt/kb-ftp-api/f', 'rb') as f:
    token_response = pickle.load(f)

print(token_response)

# let's get stuff for the Globus Transfer service
globus_transfer_data = token_response.by_resource_server['transfer.api.globus.org']
# the refresh token and access token, often abbr. as RT and AT
transfer_rt = globus_transfer_data['refresh_token']
transfer_at = globus_transfer_data['access_token']
expires_at_s = globus_transfer_data['expires_at_seconds']

authorizer = globus_sdk.RefreshTokenAuthorizer(
    transfer_rt, client, access_token=None, expires_at=expires_at_s)

print(authorizer.access_token)
parser.set('general', 'transfer_token', authorizer.access_token)

#New let's get stuff for the Globus Auth service
globus_transfer_data = token_response.by_resource_server['auth.globus.org']
# the refresh token and access token, often abbr. as RT and AT
transfer_rt = globus_transfer_data['refresh_token']
transfer_at = globus_transfer_data['access_token']
expires_at_s = globus_transfer_data['expires_at_seconds']

authorizer = globus_sdk.RefreshTokenAuthorizer(
    transfer_rt, client, access_token=None, expires_at=expires_at_s)

print(authorizer.access_token)
parser.set('general', 'auth_token', authorizer.access_token)

# Writing our configuration file 
if authorizer.access_token and len(authorizer.access_token) > 0:
    with open('/root/.globus.cfg', 'wb') as configfile:
        parser.write(configfile)
