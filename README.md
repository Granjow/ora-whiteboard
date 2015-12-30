OraWhiteboart provides online-published whiteboards. It reads OpenRaster files and updates them in the web view. 

    require( 'ora-whiteboard' ).startOraBoard( 'boards', 3311 );
    
starts a web server listening on `http://localhost:3311/index.html`. OraWhiteboard watches all `.ora` drawings 
in the `boards/` directory and updates them on the index page as soon as they change.
 
You can save new ORA files (e.g. with MyPaint), and they will automatically show up on the web site.

![Screenshot](resources/screenshot.png)

