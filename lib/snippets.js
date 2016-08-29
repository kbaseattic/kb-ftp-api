
// could be useful for copying
function autoIncrement(file) {
    fs.exists(config.ftpRoot+file.reqPath, function(exists) {
        let name;

        if (exists) {
            let n = file.originalname;
            let ext = n.slice(n.lastIndexOf('.'), -1),
                rawName = n.slice(0, n.lastIndexOf('.'));

            let verMatch = rawName.match(/\((\d+)\)$/g)[0],
                ver = parseInt(verMatch.slice(1,-1));
            
            if (ver >= 0) {
                rawName = rawName.slice(0, rawName.lastIndexOf(verMatch));
                name = rawName+'('+parseInt(ver+1)+')'+(ext ? ext : '');
            } else {
                name = rawName+' (1)'+(ext ? ext : '');
            }

        } else { 
            name = file.originalname;
        }
        cb(null, name);
    })
}
