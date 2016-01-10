(function () {
    var app = angular.module( 'oraBoard', [] );

    /**
     * Only for forwarding keyboard shortcuts to the service.
     */
    app.controller( 'whiteboardController', [ 'whiteboardService', function ( whiteboardService ) {
        this.keypressHandler = whiteboardService.keypressCallback;
    } ] );

    app.factory( 'whiteboardService', [ '$http', '$interval', function ( $http, $interval ) {

        var imageData = [];
        var selectedImage = '';

        var imageClicked = function ( name ) {
            console.log( 'Selecting image ', name );
            var changed = name !== selectedImage;
            if ( selectedImage === name ) {
                selectedImage = '';
            } else {
                selectedImage = name;
            }

            return changed;
        };

        var isSelected = function ( name ) {
            return selectedImage === name;
        };

        var getImageData = function ( name ) {
            return imageData.filter( function ( el ) {
                return el.name === name;
            } )[ 0 ];
        };


        var reload = function () {
            $http.get( '/boards/list/' ).then( function ( response ) {
                console.log( 'Data received: ', response );

                var boards = response.data.boards;
                boards.forEach( function ( board ) {
                    var ourBoard = imageData.find( function ( el ) {
                        return el.name === board.name;
                    } );

                    if ( !ourBoard ) {
                        if ( !board.deleted ) {
                            imageData.push( board );
                        }
                    } else {

                        if ( board.deleted ) {

                            console.log( 'Board was deleted: ', ourBoard, board );
                            imageData.splice( imageData.indexOf( ourBoard ), 1 );

                        } else if ( ourBoard.rev !== board.rev ) {

                            console.log( 'Board was updated:', ourBoard, board );
                            for ( var prop in board ) {
                                if ( board.hasOwnProperty( prop ) ) {
                                    ourBoard[ prop ] = board[ prop ];
                                }
                            }
                        }
                    }
                } );

            }, function ( err ) {
                console.warn( 'Failed: ', err );
            } );
        };

        var keypressCallback = function ( event ) {
            // Exit fullscreen when pressing Esc
            if ( event.keyCode === 27 ) {
                var unselected = !imageClicked( '' );
                if ( unselected ) {
                    event.preventDefault();
                }
                return unselected;
            }
            return true;
        };

        $interval( reload, 1000 );

        reload();

        return {
            imageData: imageData,
            isSelected: isSelected,
            imageClicked: imageClicked,
            getImageData: getImageData,
            keypressCallback: keypressCallback
        }

    } ] );

    app.directive( 'whiteboardsList', [ 'whiteboardService', function ( whiteboardService ) {

        return {
            restrict: 'E',
            templateUrl: './app/whiteboards-list.html',
            controller: function () {

                this.boards = whiteboardService.imageData;

                this.isSelected = function ( name ) {
                    return whiteboardService.isSelected( name );
                };

            },
            controllerAs: 'whiteboards'
        };

    } ] );

    /**
     * Thumbnail entry of a board
     */
    app.directive( 'boardImage', [ 'whiteboardService', function ( whiteboardService ) {
        return {
            restrict: 'E',
            templateUrl: './app/board-image.html',
            controller: function () {

                this.fullsize = false;
                this.fullsizeText = '100 %';

                this.toggleFullsize = function () {
                    this.fullsize = !this.fullsize;
                    this.fullsizeText = this.fullsize ? 'fit' : '100 %';
                };

                this.imageClicked = function ( name ) {
                    whiteboardService.imageClicked( name )
                };

                this.isSelected = function ( name ) {
                    return whiteboardService.isSelected( name );
                };

                this.isDeleted = function ( name ) {
                    var imageData = whiteboardService.getImageData( name );
                    return imageData && imageData.deleted;
                }

            },
            controllerAs: 'board'
        };
    } ] );

})();
