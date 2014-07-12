


function recordReplayData() {
  var savingIndex = 0
  var positions = {}
  //var fps = +chrome.storage.local.get('fps')
  //var saveDuration = +chrome.storage.local.get('duration')
  var fps = +localStorage.getItem('fps')
  var saveDuration = +localStorage.getItem('duration')

  // function to save current player positions
  function savePlayerPositions() {
    players=tagpro.players
    for(player in players) {
      if(!positions[player]) {
        positions[player] = {
                            x:new Array(saveDuration*fps), 
                            y:new Array(saveDuration*fps), 
                            name:players[player].name,
                            fps:fps,
                            team:players[player].team, // 1:red, 2:blue
                            map:$('#mapInfo').text().replace('Map: ','').replace(/ by.*/,''),
                            flag:new Array(saveDuration*fps),
                            bomb:new Array(saveDuration*fps),
                            grip:new Array(saveDuration*fps),
                            tagpro:new Array(saveDuration*fps),
                            dead:new Array(saveDuration*fps),
                            me:(tagpro.viewPort.source.id == player ? 'me' : 'other'),
                            hasFlag:null
                          }
      }
      for(i in positions[player]) {
        if($.isArray(positions[player][i])) {
          positions[player][i].shift()
          //if(tagpro.players[player].dead){
          //    positions[player][i].push(null)
          //} else {
          positions[player][i].push(tagpro.players[player][i])
          //}
        }
      }
    }  
    savingIndex++
  }
  
  thing = setInterval(savePlayerPositions, 1000/fps)
}

function saveReplayData() {
  var data = JSON.stringify(positions)
  replayFilename = 'replay' + new Date().getTime()
  eval('var items = {'+replayFilename+':data}')
  chrome.storage.local.set(items, giveFeedback)
  giveFeedback()
}

function giveFeedback() {
  $(savedFeedback).fadeIn(300)
  $(savedFeedback).fadeOut(900)
}

// function to add button to record replay data
function recordButton() {
  var recordButton = document.createElement("img")
  recordButton.id = 'recordButton'
  recordButton.src = 'http://i.imgur.com/oS1bPqR.png'
  recordButton.onclick=saveReplayData
  recordButton.style.position="absolute"
  recordButton.style.margin="auto"
  recordButton.style.right="30px"
  recordButton.style.top="45px"
  recordButton.style.cursor="pointer"
  $('body').append(recordButton)
  
  var savedFeedback = document.createElement('a')
  savedFeedback.id = 'savedFeedback'
  savedFeedback.textContent = 'Saved!'
  savedFeedback.style.right='20px'
  savedFeedback.style.top='80px'
  savedFeedback.style.position="absolute"
  savedFeedback.style.color='#00CC00'
  savedFeedback.style.fontSize='20px'
  savedFeedback.style.fontWeight='bold'
  $('body').append(savedFeedback)
  $(savedFeedback).hide()
}



function animateReplay(replayFilename) {
  var maps = {
    "Velocity"        : "http://i.imgur.com/W0u8w8h.png",
    "45"              : "http://i.imgur.com/4E4fDGl.png",
    "The Holy See"   	: "http://i.imgur.com/eQ3EBe9.png",
    "GeoKoala" 			  : "http://i.imgur.com/iDyTJlq.png", 
    "Colors" 			    : "http://i.imgur.com/Q1TcLsw.png",
    "Star" 				    : "http://i.imgur.com/ij5oCBB.png", // need to find new one
    "Hyper Reactor" 	: "http://i.imgur.com/WVHXkOC.png", 
    "Blast Off"			  : "http://i.imgur.com/bWerjaG.png",
    "Boombox"			    : "http://i.imgur.com/D3iqzZ8.png",
    "Bombing Run"		  : "http://i.imgur.com/mHHPJh2.png",
    "GamePad"         : "http://i.imgur.com/yiBCJuH.png",
    "Smirk"				    : "http://i.imgur.com/Aa2JVEc.png",
    "Danger Zone 3"		: "http://i.imgur.com/1w1oaMr.png",
    "Ricochet"			  : "http://i.imgur.com/tIsUays.png",
    "Wormy"				    : "http://i.imgur.com/0w9jvUK.png",
    "Command Center"	: "http://i.imgur.com/Bq8PIwY.png",
    "CFB"             : "http://i.imgur.com/1KFQ3GK.png"
  }

  var flags = {
    "1" : "http://i.imgur.com/5MQeHko.png", // red flag
    "2" : "http://i.imgur.com/KfiDvZZ.png", // blue flag
    "3" : "http://i.imgur.com/hwq3qyb.png"  // yellow flag
  }

  function first(obj) {
    for (var a in obj) return a;
  }


  /*##################*\
  Animate thing.
  \*##################*/

  secs = 1
  i=0
  
  //positionData = JSON.parse(chrome.storage.local.get(replayFilename))
  positionData = JSON.parse(localStorage.getItem(replayFilename))

  var player={}
  var viewport={}
  viewport.width=$(window).width()
  viewport.height=$(window).height()

  var me={}
  var thisOther={}


  // create a container for the playback
  $('article').append('<div id=bigContainer>')
  $('#bigContainer').css({'top':'0',
                        'left':'0',
                        'bottom':'0',
                        'right':'0'})
  $('#bigContainer').hide()


  // make a black background
  $('#bigContainer').append('<img id=tester>')
  $('#tester')[0].style['background-color']='black'
  $('#tester').css({"background-repeat": "no-repeat", 
            "background-position": "0px 0px",
            "width": viewport.width+"px", 
            "height": viewport.height+"px",
            "position": "absolute",
            "margin": "auto",
            "top": "0",
            "left": "0",
            "right": "0",
            "bottom": "0"
  })

  // put the map on the screen
  $('#bigContainer').append('<img id=mapIMG>')
  mapIMG = $('#mapIMG') 
  mapURL = maps[positionData[first(positionData)].map]
  mapIMG.css({"background-image": "url("+mapURL+")", 
            "background-repeat": "no-repeat", 
            "background-position": "0px 0px",
            "width": viewport.width+"px", 
            "height": viewport.height+"px",
            "position": "absolute",
            "margin": "auto",
            "top": "0",
            "left": "0",
            "right": "0",
            "bottom": "0"
  })

  // create flag images on screen, hidden at first
  // red flag
  flag1URL = flags['1']
  $('#bigContainer').append('<img id=flag1 src='+flag1URL+'>')
  flag1 = $('#flag1')
  flag1.css({"position": "absolute",
           "margin": "auto",
           "top": "-60px",
           "left": "60px",
           "right": "0",
           "bottom": "0"
  })
  flag1.hide()

  // blue flag
  flag2URL = flags['2']
  $('#bigContainer').append('<img id=flag2 src='+flag2URL+'>')
  flag2 = $('#flag2')
  flag2.css({"position": "absolute",
           "margin": "auto",
           "top": "-60px",
           "left": "60px",
           "right": "0",
           "bottom": "0"
  })
  flag2.hide()

  // yellow flag
  flag3URL = flags['3']
  $('#bigContainer').append('<img id=flag3 src='+flag3URL+'>')
  flag3 = $('#flag3')
  flag3.css({"position": "absolute",
           "margin": "auto",
           "top": "-60px",
           "left": "60px",
           "right": "0",
            "bottom": "0"
  })
  flag3.hide()


  // define image URLs for ball images
  bbImgUrl = "http://i.imgur.com/atFNIaf.png"
  rbImgUrl = "http://i.imgur.com/qQDnx31.png"

  // function that takes an integer input and creates a ball image on screen  
  function createBall(ball) {
    // first create the ball image
    $('#bigContainer').append('<img id=ball'+ball+' src='+(positionData[ball].team == 1 ? rbImgUrl : bbImgUrl)+'>')
    $('#ball'+ball).css({"position": "absolute",
                "margin": "auto",
                "top": "0",
                "left": "0",
                "right": "0",
                "bottom": "0"
    })
    // then create the text label with player display name
    $('#bigContainer').append('<text  class="abc" id=text'+ball+' >'+positionData[ball].name+'</text>')
    $('#text'+ball).css({"position": "absolute",
                "margin": "auto",
                "top": ((viewport.height/2)-40)+"px", 
                "left": ((viewport.width/2)-20)+"px",
                "right": "0",
                "bottom": "0",
                "color": "white",
                "text-shadow" : "0px 0px 10px black"
    })
  }

  for(ball in positionData) {
    createBall(ball)
    if(positionData[ball].me == 'me') {
      ballMe = ball
    }
  }

  function updateOtherPlayers(ball, i) {
    if(positionData[ball].dead[i] | noMotion(ball,secs)) {
      $('#ball'+ball)[0].style.top = '20000px'
      $('#ball'+ball)[0].style.left = '20000px'
      $('#text'+ball)[0].style.top = '20000px'
      $('#text'+ball)[0].style.left = '20000px'
    } else {
      me.x = positionData[ballMe].x[i]
      me.y = positionData[ballMe].y[i]
      thisOther.x = positionData[ball].x[i]
      thisOther.y = positionData[ball].y[i]
      relativeX = (thisOther.x - me.x) * 2
      relativeY = (thisOther.y - me.y) * 2
      $('#ball'+ball)[0].style.top =  relativeY+'px'
      $('#ball'+ball)[0].style.left = relativeX+'px'
      $('#text'+ball)[0].style.top =  ((thisOther.y - me.y)+((viewport.height/2)-40))+"px"
      $('#text'+ball)[0].style.left = ((thisOther.x - me.x)+((viewport.width/2)-20))+"px"
    }
  }

  function updateFlagStatus(ball) {
    // if player had flag but lost it
    if(positionData[ball].hasFlag!=null & positionData[ball].flag[i]==null) {
      $('#flag'+positionData[ball].hasFlag).hide()
      positionData[ball].hasFlag=null
    }
    // if player didn't have flag but now has it
    if(positionData[ball].hasFlag==null & positionData[ball].flag[i]!=null) {
      positionData[ball].hasFlag=positionData[ball].flag[i]
      $('#flag'+positionData[ball].hasFlag).show()
      if(positionData[ball].me=='other') {
        me.x = positionData[ballMe].x[i]
        me.y = positionData[ballMe].y[i]
        thisOther.x = positionData[ball].x[i]
        thisOther.y = positionData[ball].y[i]
        relativeX = (thisOther.x - me.x) * 2
        relativeY = (thisOther.y - me.y) * 2
        $('#flag'+positionData[ball].hasFlag)[0].style.top = relativeY+'px'
        $('#flag'+positionData[ball].hasFlag)[0].style.left = relativeX+'px'
      } else {
        $('#flag'+positionData[ball].hasFlag)[0].style.top = '-60px'
        $('#flag'+positionData[ball].hasFlag)[0].style.left = '60px'
      }
    }
    // if player has the flag
    if(positionData[ball].hasFlag!=null & positionData[ball].flag[i]!=null) {
      $('#flag'+positionData[ball].hasFlag).show()
      if(positionData[ball].me=='other') {
        me.x = positionData[ballMe].x[i]
        me.y = positionData[ballMe].y[i]
        thisOther.x = positionData[ball].x[i]
        thisOther.y = positionData[ball].y[i]
        relativeX = (thisOther.x - me.x) * 2
        relativeY = (thisOther.y - me.y) * 2
        $('#flag'+positionData[ball].hasFlag)[0].style.top = (relativeY - 60)+'px'
        $('#flag'+positionData[ball].hasFlag)[0].style.left = (relativeX + 60)+'px'
      }
    }
  }

  function noMotion(ball,secs) {
    if($('#ball'+ball)[0].style.left==null | i < secs*positionData[ball].fps) {return(false)}
    xtest = positionData[ball].x[i] == positionData[ball].x[i-(secs*positionData[ball].fps)]
    ytest = positionData[ball].y[i] == positionData[ball].y[i-(secs*positionData[ball].fps)]
    return(xtest & ytest)
  }

  function checkIfDead(ball) {
    // if player is dead but is being shown, hide that player
    if(positionData[ball].dead[i] & $('#ball'+ball)[0].style.display!='none') {
      $('#ball'+ball).hide()
      $('#text'+ball).hide()
  
    // if player is alive but is not being shown, show that player
    } else if(!positionData[ball].dead[i] & $('#ball'+ball)[0].style.display=='none') {
      $('#ball'+ball).show()
      $('#text'+ball).show()
    }
  }

  function updateMap() {
    player.x = positionData[ballMe].x[i]
    player.y = positionData[ballMe].y[i]
    mapIMG.css({"background-position": + (-(player.x + 20 - viewport.width/2))+"px "+ (-(player.y + 20 -viewport.height/2))+"px"})
    for(ball in positionData) {
      checkIfDead(ball)
      updateFlagStatus(ball)
      if(positionData[ball].me == 'other') {
        updateOtherPlayers(ball, i)
      }
    }
    i++
  }


  // functions to control replay playback
  function resetReplay() {
    i=0
    clearInterval(thingy)
    updateMap()
    delete(thingy)
    isPlaying=false
    showButtons()
  }
  function stopReplay() {
    i=0
    if(typeof thingy !== 'undefined') {
      clearInterval(thingy)
      delete(thingy)
      isPlaying=false
    }
    $('#bigContainer').fadeOut(600)
    $('#menuContainer').fadeIn()
    setTimeout(function(){$('#bigContainer').remove()}, 1000)
  }
  function playReplay() {
    if(typeof thingy === 'undefined') {
      thingy = setInterval(updateMap, 1000/positionData[first(positionData)].fps)
      isPlaying=true
      hideButtons()
    }
  }
  function pauseReplay() {
    clearInterval(thingy)
    delete(thingy)
    isPlaying=false
    showButtons()
  }
  
  // playback control buttons
  buttonURLs = {
    'stop'    : 'http://i.imgur.com/G32WYvH.png',
    'play'    : 'http://i.imgur.com/KvSKqpI.png',
    'pause'   : 'http://i.imgur.com/aSpd4cK.png',
    'forward' : 'http://i.imgur.com/TVtAO69.png',
    'reset'   : 'http://i.imgur.com/vs3jWpc.png'
  }
  
  // stop button
  var stopButton = document.createElement("img")
  stopButton.id = 'stopButton'
  stopButton.src = buttonURLs['stop']
  stopButton.onclick=stopReplay
  stopButton.onmouseover = showButtons
  stopButton.onmouseleave = function() {if(isPlaying) hideButtons()}
  stopButton.style.position="absolute"
  stopButton.style.bottom="20px"
  stopButton.style.left=(viewport.width/2 - 199)+"px"
  stopButton.style.transition="opacity 0.25s linear"
	$('#bigContainer').append(stopButton)
  
  // reset button
  var resetButton = document.createElement("img")
  resetButton.id = 'resetButton'
  resetButton.src = buttonURLs['reset']
  resetButton.onclick=resetReplay
  resetButton.onmouseover = showButtons
  resetButton.onmouseleave = function() {if(isPlaying) hideButtons()}
  resetButton.style.position="absolute"
  resetButton.style.bottom="20px"
  resetButton.style.left=(viewport.width/2 - 85)+"px"
  resetButton.style.transition="opacity 0.25s linear"
  $('#bigContainer').append(resetButton)
  
  // play button
  var playButton = document.createElement("img")
  playButton.id = 'playButton'
  playButton.src = buttonURLs['play']
  playButton.onclick=playReplay
  playButton.onmouseover = showButtons
  playButton.onmouseleave = function() {if(isPlaying) hideButtons()}
  playButton.style.position="absolute"
  playButton.style.bottom="20px"
  playButton.style.left=(viewport.width/2 + 28)+"px"
  playButton.style.transition="opacity 0.25s linear"
  $('#bigContainer').append(playButton)

  // pause button
  var pauseButton = document.createElement("img")
  pauseButton.id = 'pauseButton'
  pauseButton.src = buttonURLs['pause']
  pauseButton.onclick=pauseReplay
  pauseButton.onmouseover = showButtons
  pauseButton.onmouseleave = function() {if(isPlaying) hideButtons()}
  pauseButton.style.position="absolute"
  pauseButton.style.bottom="20px"
  pauseButton.style.left=(viewport.width/2 + 142)+"px" 
  pauseButton.style.transition="opacity 0.25s linear"
  $('#bigContainer').append(pauseButton)
  
  // functions to show or hide buttons
  function showButtons() {
    var buttons = {pause  : pauseButton,//$('#pauseButton'),
                   play   : playButton,//$('#playButton'),
                   stop   : stopButton,//$('#stopButton'),
                   reset  : resetButton,//$('#resetButton')
    }
    for(button in buttons) {
      buttons[button].style.opacity="1.0"
      buttons[button].style.cursor="pointer"
    }
  }
  
  function hideButtons() {
    var buttons = {pause  : pauseButton,//$('#pauseButton'),
                   play   : playButton,//$('#playButton'),
                   stop   : stopButton,//$('#stopButton'),
                   reset  : resetButton,//$('#resetButton')
    }
    for(button in buttons) {
      buttons[button].style.opacity="0"
    }
  }
  
  
  // because of the way the play button works, must ensure 'thingy' is undefined first
  delete(thingy)
  // define variable that stores play state
  isPlaying = false
  // show the div with all the replay images on it
  $('#bigContainer').fadeIn(600)
  // move to first 'frame' of the replay to make it look nicer to start
  updateMap()
  
}

function createReplayPageButton() {
  function findInsertionPoint() {
    buttons = $('article>div.buttons.smaller>a')
    for (var i = 0; i < buttons.length; i ++) {
        textcontent = buttons[i].textContent
        if(textcontent.search('Leaders')>=0) {
          return(buttons[i])
        }
    }
  }
  $(findInsertionPoint()).after('<a class=button id=ReplayMenuButton>Replays')
  $('#ReplayMenuButton').append('<span>watch yourself')
  $('#ReplayMenuButton')[0].onclick=openReplayMenu
}

function openReplayMenu() {
  // create a container for the playback menu
  $('article').append('<div id=menuContainer>')
  $('#menuContainer').css({
            "width" : "75%",
            "height" : "75%",
            "position": "absolute",
            "margin": "auto",
            "top": "0",
            "left": "0",
            "right": "0",
            "bottom": "0"})
  $('#menuContainer').hide()
  
  // make a background
  $('#menuContainer').append('<img id=background>')
  $('#background')[0].style['background-color']='#E6E6E6'
  $('#background').css({
            "width" : "100%",
            "height" : "100%",
            "position": "absolute",
            "opacity" : ".8"
  })
  
  // make a border for the background
  $('#background').after('<div id=backgroundBorder>')
  $('#backgroundBorder').css({
            "position" : "absolute",
            "top" : "0",
            "left" : "0",
            "right" : "0",
            "bottom" : "0",
            "border" : "solid 10px white"
  })
  
  // add area for available replays 
  $('#background').after('<div id=replayListBox>')
  $('#replayListBox').css({
            "background-color" : "grey",
            "width" : "80%",
            "height" : "50%",
            "position" : "absolute",
            "margin" : "auto",
            "top" : "40%",
            "left" : "10%",
            "overflow" : "auto",
            "opacity" : ".8",
            "z-index" : "100"
  })
  
  // add title box
  $('#menuContainer').append('<div id=titleBox>')
  $('#titleBox').css({
            "width" : "80%",
            "height" : "10%",
            "position" : "absolute",
            "margin" : "auto",
            "top" : "10%",
            "left" : "10%"
  })
  $('#titleBox').append('<txt id=titleText>TagPro Replays Menu')
  $('#titleText').css({
            "width" : "100%",
            "position" : "absolute",
            "margin" : "auto",
            "text-align" : "center",
            "fontSize" : "60px",
            "color" : "black"
  })
  
  // add settings
  $('#menuContainer').append('<div id=settingsContainer>')
  $('#settingsContainer').css({
            "width" : "80%",
            "height" : "10%",
            "position" : "absolute",
            "margin" : "auto",
            "top" : "25%",
            "left" : "10%"            
  })
  $('#settingsContainer').append('<txt id=settingsTxt>')
  $('#settingsTxt').text('Recording Settings:')
  $('#settingsTxt').css({
            "fontSize" : "18px",
            "color" : "black",
            "margin" : "20px"
  })
  $('#settingsTxt').after('<txt id=fpsTxt>')
  $('#fpsTxt').text('FPS')
  $('#fpsTxt').css({
            "fontSize" : "18px",
            "color" : "black",
            "margin" : "10px"
  })
  $('#fpsTxt').after('<input id=fpsInput>')
  $('#fpsInput').css({
            "margin-right" : "20px"
  })
  
  $('#fpsInput').after('<txt id=durationTxt>')
  $('#durationTxt').text('Recording Duration (s)')
  $('#durationTxt').css({
            "fontSize" : "18px",
            "color" : "black",
            "margin" : "10px"
  })
  $('#durationTxt').after('<input id=durationInput>')
  
  // Replay menu title
  $('#menuContainer').append('<div id=replayListContainer>Available Replays')
  $('#replayListContainer').css({
            "width" : "80%",
            "height" : "10%",
            "position" : "absolute",
            "margin" : "auto",
            "top" : "35%",
            "left" : "10%",
            "fontSize" : "20px",
            "color" : "black",
            "text-align" : "center"
  })
  
  function exitMenu() {
    fpsInputValue = $('#fpsInput')[0].value
    durationInputValue = $('#durationInput')[0].value
    if(!isNaN(fpsInputValue) & fpsInputValue!="") {
      //chrome.storage.local.set({fps:$('#fpsInput')[0].value})
      localStorage.setItem('fps',$('#fpsInput')[0].value)
    }
    if(!isNaN(durationInputValue) & durationInputValue!="") {
      //chrome.storage.local.set({duration:$('#durationInput')[0].value})
      localStorage.setItem('duration',$('#durationInput')[0].value)  
    }
    $("#menuContainer").fadeOut() 
    setTimeout(function(){$("#menuContainer").remove()},500)
  }
  
  $('#menuContainer').append('<a id=exitButton href=#>X')
  $('#exitButton').css({
    'position':'absolute',
    'background-color':'grey',
    'color' : 'black',
    'top' : '5%',
    'right' : '5%',
    'fontWidth' : 'bold',
    'fontSize' : '20px'
  })
  $('#exitButton')[0].onclick = exitMenu
  
  function populateList() {
    //storageData = chrome.storage.local.get()
    storageData = localStorage
    replayList = []
    for(dat in storageData) {
      if(dat.search('replay')==0) {
        replayList.push(dat)
      }
    }
    if(!replayList.length > 0) {
      $('#replayListBox').append("<p><a>You don't have any replays saved. Go record some!")
    } else {
      for(dat in replayList) {
        thisReplay = replayList.reverse()[dat]
        $('#replayListBox').append("<p><a id="+thisReplay+" href=# style='margin-left:5%'>"+thisReplay+"</a></p>")
        $('#'+thisReplay)[0].onclick = function(){
          $('#menuContainer').fadeOut()
          animateReplay(this.id) 
        }
        
        ms = +thisReplay.replace('replay','')
        date = new Date(ms)
        datevalue = date.toDateString() + " " + date.toLocaleTimeString()
        $('#'+thisReplay).after('<txt style="margin-left:40%">'+datevalue)
      }
    }
  }
  
  // Set fps and duration text box values 
  //fpsValue = chrome.storage.local.get('fps')
  //durationValue = chrome.storage.local.get('duration')
  fpsValue = localStorage.getItem('fps')
  durationValue = localStorage.getItem('duration')
  $('#fpsInput')[0].value=(!isNaN(fpsValue) & fpsValue!="") ? fpsValue : "30"
  $('#durationInput')[0].value=(!isNaN(durationValue) & durationValue!="") ? durationValue : "60"

  populateList()
  $('#menuContainer').fadeIn()
}



// To Do: 
//      4 - add replays menu (populated by local data replays)
//      5 - add settings feature to set fps and length of recording
//
// Farther along to do:
//      1 - get powerup indicators for the balls working
//      2 - various map-related things, like powerups, gates, bombs, etc



// How data saving will work:
// 1 - when user hits record button, content script saves positions in localStorage
// 2 - at some point, maybe beforeunload, content script sends positions to background script
// 3 - background script then saves positions to indexedDB
// 4 - when replay menu is created/opened, content script requests list of replays from background script
// 5 - when user clicks on one replay, content script requests that replay data from background script


