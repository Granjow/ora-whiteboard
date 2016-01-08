OraWhiteboart provides online-published whiteboards. It reads OpenRaster files and updates them in the web view. 

    require( 'ora-whiteboard' ).startOraBoard( 'boards', { port: 3311 } );
    
starts a web server listening on `http://localhost:3311/`. OraWhiteboard watches all `.ora` drawings 
in the `boards/` directory and updates them on the index page as soon as they change.
 
You can save new ORA files (e.g. with MyPaint), and they will automatically show up on the web site.

![Screenshot](resources/screenshot.png)

## Working with network and Virtual Machine shares

    require( 'ora-whiteboard' ).startOraBoard( 'boards', { port: 3311, sharedFs: true } );

will use `fs.watchFile()` instead of `fs.watch()`, which periodically checks for modifications instead of subscribing 
to changes (which is not supported on shared file systems like network shares, or shared folders in VMs).
