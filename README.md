
# KBase FTP API (under dev)

This repo contains a REST-like API for accessing a user's FTP space.


## Requirements

node


## Local Installation

```
git clone https://github.com/kbase/kb-ftp-api.git
cd kb-ftp-api
npm install
```


## Start Dev Server

```
node server.js --dev
```

To make our lives easier, running `gulp` starts a development server along with a process to
update ./api-documentation.json.  The dev server will restart automatically on file change (any .js file).
For testing, a token can be placed in the file `./dev-user-token`.

```
gulp
```

## Running Tests

Running tests requires a little local setup. You'll need to do the following:
1. **Set the test environment.**
In `config/env.json` , set the deployment to "test". In the config directory, you can also modify `config-test.json` to your liking. Mainly, you'll need to set the "ftpRoot" key to a local directory of your choosing, that will be modified by the tests.

2. **Make a local file storage directory.**
As mentioned above, you need a local directory to act as a dummy FTP root. Create that and set it in `config/config-test.json`

3. **Set the test configuration.**
Running tests requires a file called `tests/test-cfg.json`. This is a JSON file with the following structure:
```
{
    "authToken": Valid authentication token string,
    "userId": The user id linked to that token
}
```

4. **Start a server.**
```
node server.js
```

5. **Run the tests.**
API tests are run with `npm test` or `gulp test`.


## Building Web Documentation

Docstrings in server.js are parsed into JSON using `./docs/parse-docs.js`.
The resulting JSON structure `./api-documentation.json` is then used to produce
fancy online documentation.

Note: `api-documentation.json` is automatically rebuilt with gulp.
To manually build it, run:

```
gulp docs
```


## Production

The server script `server.js` should be ran with <a href="https://github.com/foreverjs/forever">forever</a>.

```
forever start -l /logs/server.log --pidFile /tmp/a -a server.js
```


## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Author(s)

Neal Conrad <nconrad@anl.gov>
Erik Pearson <eapearson@lbl.gov>
Bill Riehl <wjriehl@lbl.gov>


## License

Released under [the KBase license](https://github.com/kbase/kb-ftp-api/blob/master/LICENSE).
