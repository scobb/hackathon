#pragma strict

var AstarController : AstarPath;

//States
var waveActive : boolean = false;
var spawnEnemies : boolean = false;
var upgradePanelOpen : boolean = false;

//Player Variables
var healthCount : int = 10;
var scoreCount : int = 0;
var cashCount : int = 200;

// Define Wave Specific Variables
var waveLevel : int = 0;
var difficultyMultiplier : float = 1.0;
var waveLength : float = 30.0;
var intermissionTime : float = 5.0;
private var waveEndTime : float = 0;

//Enemy Variables
var enemyPrefabs : GameObject[];
var flyerSpawns : Transform;
var groundSpawns : Transform;
private var flyerSpawnPoints : Transform[];
private var groundSpawnPoints : Transform[];
var respawnMinBase : float = 3.0;
var respawnMaxBase : float = 10.0;
private var respawnMin : float = 3.0;
private var respawnMax : float = 10.0;
var respawnInterval : float = 2.5;
var enemyCount : int = 0;
private var lastSpawnTime : float = 0;

//Turrets
var turretCosts : int[];
var onColor : Color;
var offColor : Color;
var allStructures : GameObject[];
var buildBtnGraphics : UISlicedSprite[];
var costTexts : UILabel[];
private var structureIndex : int =0;

//--- GUI Items

//GUI Variables
var waveText : UILabel;
var healthText : UILabel;
var scoreText : UILabel;
var cashText : UILabel;
var upgradeText : UILabel;
var upgradeBtn : GameObject;

//NGUI items
var buildPanelOpen : boolean = false;
var buildPanelTweener : TweenPosition;
var buildPanelArrowTweener : TweenRotation;
var upgradePanelTweener : TweenPosition;
//

//Placement Plane items
var placementPlanesRoot : Transform;
var hoverMat : Material;
var placementLayerMask : LayerMask;
private var originalMat : Material;
private var lastHitObj : GameObject;
//

//upgrade vars
private var focusedPlane : PlacementPlane;
private var structureToUpgrade : Turret_Base;
private var upgradeStructure : GameObject;
private var upgradeCost : int;
//

//---

//called first thing on level start
function Start()
{
	//reset the structure index, refresh the GUI
	structureIndex = 0;
	UpdateGUI();
	
	//gather all the flyer spawn points into an array, so we don't have to do it manually
	flyerSpawnPoints = new Transform[flyerSpawns.childCount];
	var i : int = 0;
	for(var theSpawnPoint : Transform in flyerSpawns)
	{
		flyerSpawnPoints[i] = theSpawnPoint;
		i++;
	}
	//
	
	//gather all the GROUND spawn points into an array, so we don't have to do it manually
	groundSpawnPoints = new Transform[groundSpawns.childCount];
	var g : int = 0;
	for(var theGroundSpawnPoint : Transform in groundSpawns)
	{
		groundSpawnPoints[g] = theGroundSpawnPoint;
		g++;
	}
	//
	
	//NEW
	SetNextWave(); //setup the next wave variables (ie difficulty, respawn time, speed, etc)
	StartNewWave(); //start the new wave!
	//
}
//

//called every frame
function Update () 
{
	//-- GUI
	if(buildPanelOpen) //if the build panel is open...
	{	
		//create a ray, and shoot it from the mouse position, forward into the game
		var ray = Camera.main.ScreenPointToRay (Input.mousePosition);
		var hit : RaycastHit;
		if(Physics.Raycast (ray, hit, 1000, placementLayerMask)) //if the RAY hits anything on right LAYER, within 1000 meters, save the hit item in variable "HIT", then...
		{
			if(lastHitObj) //if we had previously hit an object...
			{
				lastHitObj.renderer.material = originalMat; //visually de-select that object
			}
			
			lastHitObj = hit.collider.gameObject; //replace the "selected plane" with this new plane that the raycast just hit
			originalMat = lastHitObj.renderer.material; //store the new plane's starting material, so we can reset it later
			lastHitObj.renderer.material = hoverMat; //set the plane's material to the highlighted look
		}
		else //...if the raycast didn't hit anything (ie, the mouse moved outside the tiles) ...
		{
			if(lastHitObj) //if we had previously hit something...
			{
				lastHitObj.renderer.material = originalMat; //visually de-select that object
				lastHitObj = null; //nullify the plane selection- this is so that we can't accidentally drop turrets without a proper and valid location selected
			}
		}
		
		//drop turrets on click
		if(Input.GetMouseButtonDown(0) && lastHitObj && !upgradePanelOpen) //left mouse was clicked, and we have a tile selected
		{
			focusedPlane = lastHitObj.GetComponent(PlacementPlane); //cache the script for this plane
			if(focusedPlane.isOpen && turretCosts[structureIndex] <= cashCount) //if the plane has nothing obstructing it, and we have enough cash
			{
				//drop the chosen structure exactly at the tile's position, and rotation of zero. See how the "index" comes in handy here? :)
				var newStructure : GameObject = Instantiate(allStructures[structureIndex], lastHitObj.transform.position, Quaternion.identity);
				//set the new structure to have a random rotation, just for looks
				newStructure.transform.localEulerAngles.y = (Random.Range(0,360));
				//set this tile's tag to "Taken", so we can't double-place structures
				focusedPlane.myStructure = newStructure;
				focusedPlane.isOpen = false;
				
				cashCount -= turretCosts[structureIndex];
				UpdateGUI();
				
				//update the Graph
				AstarController.Scan();
				
				//update all enemy paths
				for(var theEnemy : GameObject in GameObject.FindGameObjectsWithTag("Ground Enemy"))
				{
					theEnemy.GetComponent(Enemy_GroundUnit).GetNewPath();
				}
			}
			else if(focusedPlane.myStructure != null) //if the plane already holds a turret
			{
				ShowUpgradeGUI(); //show upgrade option if available			
			}
			
			/* Old method
			if(lastHitObj.tag == "PlacementPlane_Open") //if the selected tile is "open"...
			{
				//drop the chosen structure exactly at the tile's position, and rotation of zero. See how the "index" comes in handy here? :)
				var newStructure : GameObject = Instantiate(allStructures[structureIndex], lastHitObj.transform.position, Quaternion.identity);
				//set the new structure to have a random rotation, just for looks
				newStructure.transform.localEulerAngles.y = (Random.Range(0,360));
				//set this tile's tag to "Taken", so we can't double-place structures
				lastHitObj.tag = "PlacementPlane_Taken";
				
				cashCount -= turretCosts[structureIndex];
				UpdateGUI();
			}
			*/
		}
	}
	//-- GUI	
	
	// Waves
	if(waveActive)
	{
		if(Time.time >= waveEndTime)
		{
			//Debug.Log("wave over!");
			//stop spawning enemies
			spawnEnemies = false;
			//check for remaining enemies
			if(enemyCount == 0)
			{
				FinishWave(); //end this wave
			}
		}
		
		if(spawnEnemies)
		{
			if(Time.time > (lastSpawnTime + respawnInterval)) //wave is still going, spawn enemies
			{
				SpawnNewEnemy();
			}
		}
	}
	//
}
//

//Upgrading Structures
function ShowUpgradeGUI()
{	
	//get the plane's structure, and that structure's upgrade options
	structureToUpgrade = focusedPlane.myStructure.GetComponent(Turret_Base);
	upgradeStructure = structureToUpgrade.myUpgrade;

	//if the structure can be upgraded, show menu
	if(upgradeStructure != null)
	{
		upgradePanelOpen = true; //first off, set the state
		
		upgradeCost = structureToUpgrade.myUpgradeCost; //get the upgrade cost
		var upgradeName = structureToUpgrade.myUpgradeName; //get the upgrade name
		
		upgradeText.text = "Upgrade to "+upgradeName+" for $"+upgradeCost+"?"; //set the text
		CostCheckButton(upgradeBtn, upgradeCost); //set the "confirm" button to active or not, based on cost
		upgradePanelTweener.Play(true); //fly in the panel
	}
}

function ConfirmUpgrade()
{
	var spawnPos = structureToUpgrade.transform.position; //get tower pos
	var spawnRot = structureToUpgrade.transform.rotation; //get tower rotation
	Destroy(structureToUpgrade.gameObject); //destroy old tower
	var newStructure : GameObject = Instantiate(upgradeStructure, spawnPos, spawnRot); //spawn in new, "upgraded" tower
	focusedPlane.myStructure = newStructure;
	
	cashCount -= upgradeCost; //subtract upgrade cost
	UpdateGUI(); //update the GUI
	upgradePanelTweener.Play(false); //hide the upgrade panel
	upgradePanelOpen = false; //update the state
}

function CancelUpgrade()
{
	upgradePanelTweener.Play(false); //hide the upgrade panel
	upgradePanelOpen = false; //update the state
}
//

//End the wave
function FinishWave()
{
	waveActive = false;
	
	//wait for it...
	yield WaitForSeconds(intermissionTime);
	
	//on to the next!
	SetNextWave();
	StartNewWave();
}
//

//Prepare for next wave
function SetNextWave()
{
	waveLevel++; //up the wave level
	difficultyMultiplier = ((Mathf.Pow(waveLevel, 2))*.005)+1; //up the difficulty, exponentially
	respawnMin = respawnMinBase * (1/difficultyMultiplier); //apply dif mult to respawn times (ie, more units)
	respawnMax = respawnMaxBase * (1/difficultyMultiplier);
}
//

//start the new wave
function StartNewWave()
{
	//Set the GUI
	UpdateGUI();
	
	//spawn the first enemy
	SpawnNewEnemy();
	
	//set the wave end time
	waveEndTime = Time.time + waveLength;
	
	//activate the wave
	waveActive = true;
	spawnEnemies = true;
}
//

//Spawn new enemies
function SpawnNewEnemy()
{
	//get a random index to choose an enemy prefab with
	var enemyChoice = Random.Range(0,enemyPrefabs.length);
	
	//since air and ground units probably shouldn't spawn in the same locations, we have to seperate this part, and spawn based on tag
	var spawnChoice : int;
	if(enemyPrefabs[enemyChoice].tag == "Air Enemy") //spawn air enemy
	{
		//get a random index to choose spawn location with
		spawnChoice = Random.Range(0,flyerSpawnPoints.length);
		//spawn the flyer, at the chosen location and rotation
		Instantiate(enemyPrefabs[enemyChoice], flyerSpawnPoints[spawnChoice].position, flyerSpawnPoints[spawnChoice].rotation);
	}
	else if(enemyPrefabs[enemyChoice].tag == "Ground Enemy") //spawn ground enemy
	{
		//get a random index to choose spawn location with
		spawnChoice = Random.Range(0,groundSpawnPoints.length);
		//spawn the ground unit, at the chosen location and rotation
		Instantiate(enemyPrefabs[enemyChoice], groundSpawnPoints[spawnChoice].position, groundSpawnPoints[spawnChoice].rotation);
	}

	//let the game know we just added an enemy, for keeping track of wave completion
	enemyCount++;
	
	//set the current time as the last spawn time
	lastSpawnTime = Time.time;
	
	//re-randomize the respawn interval
	respawnInterval = Random.Range(respawnMin, respawnMax);
}
//

//
//-- Custom Functions --//

//One Update to Rule them All!
//this function will eventually contain all generic update events
//this makes sure we don't have the same small parts being called over and over in different ways, throughout the script
function UpdateGUI()
{
	//Go through all structure buttons (the buttons in the build panel), and set them to "off"
	for(var theBtnGraphic : UISlicedSprite in buildBtnGraphics)
	{
		theBtnGraphic.color = offColor;
	}
	//set the selected build button to "on"
	buildBtnGraphics[structureIndex].color = onColor;
	
	waveText.text = "Wave: "+waveLevel;
	scoreText.text = "Score: "+scoreCount;
	healthText.text = "Shields: "+healthCount;
	cashText.text = "Cash: "+cashCount;
	
	CheckTurretCosts();
}

//Called whenever a structure choice is clicked (the button in the build panel)
function SetBuildChoice(btnObj : GameObject)
{
	//when the buttons are clicked, they send along thier GameObject as a parameter, which is caught by "btnObj" above
	//we then use that btnObj variable, and get it's name, so we can easily check exactly which button was pressed
	var btnName : String = btnObj.name;
	
	//here, we set an "index"  based on which button was pressed
	//by doing this, we can easily tell, from anywhere in the script, which structure is currently selected
	//also, if we order things just right, we can use this "index" to reference the correct array items automatically!
	if(btnName == "Btn_Cannon")
	{
		structureIndex = 0;
	}
	else if(btnName == "Btn_Missile")
	{
		structureIndex = 1;
	}
	else if(btnName == "Btn_Mine")
	{
		structureIndex = 2;
	}
	
	//call this as a seperate function so that, as things get more complicated,
	//all GUI can be updated at once, in the same way
	UpdateGUI();
}

//Happens whenever the build panel arrow button is clicked
function ToggleBuildPanel()
{
	if(buildPanelOpen) //is the build panel already open? if so, do this...
	{
		//hide all build tiles
		for(var thePlane : Transform in placementPlanesRoot)
		{
			thePlane.gameObject.renderer.enabled = false;
		}
		
		//fly out the build panel
		buildPanelTweener.Play(false);
		//rotate the build panel arrow
		buildPanelArrowTweener.Play(false);
		//mark the panel as "closed"
		buildPanelOpen = false;
	}
	else //...the build panel was closed, so instead do this...
	{
		//show all build tiles
		for(var thePlane : Transform in placementPlanesRoot)
		{
			thePlane.gameObject.renderer.enabled = true;
		}
		
		//fly in the build panel
		buildPanelTweener.Play(true);
		//rotate the build panel arrow
		buildPanelArrowTweener.Play(true);
		//mark the panel as "open"
		buildPanelOpen = true;
	}	
}

//Checks to make sure we can purchase!
function CheckTurretCosts()
{
	//iterate over all structure buttons
	for(var i : int = 0;i<allStructures.length;i++)
	{
		if(turretCosts[i] > cashCount) //is the cost of this button's turret too much?
		{
			costTexts[i].color = Color.red; //set cost text to red color
			buildBtnGraphics[i].color = Color(.5,.5,.5,.5); //set btn graphic to half-alpha grey
			buildBtnGraphics[i].transform.parent.gameObject.collider.enabled = false; //disable this btn
		}
		else //hurray, we can afford this button's turret!
		{
			costTexts[i].color = Color.green; //set cost text to green color
			
			if(structureIndex == i) //is this button currently selected for placement?
				buildBtnGraphics[i].color = onColor; //set the color to "on"
			else //nope, this button is not currently selected, so...
				buildBtnGraphics[i].color = offColor; //...set the color to "off"
				
			buildBtnGraphics[i].transform.parent.gameObject.collider.enabled = true; //enable this button
		}
	}
}

//Generic function to quickly check if we can afford an item, and apply colors and settings to the item's button
function CostCheckButton(theBtn : GameObject, itemCost : int) 
{
	if(cashCount < itemCost) //we can't afford this item :(
	{
		theBtn.transform.Find("Label").gameObject.GetComponent(UILabel).color = Color.red; //set cost text to red color
		theBtn.transform.Find("Background").gameObject.GetComponent(UISlicedSprite).color = Color(.5,.5,.5,.5); //set btn graphic to half-alpha grey
		theBtn.collider.enabled = false; //disable button collider
	}
	else //we can afford this item! :)
	{
		theBtn.transform.Find("Label").gameObject.GetComponent(UILabel).color = Color.green; //set cost text to red color
		theBtn.transform.Find("Background").gameObject.GetComponent(UISlicedSprite).color = onColor; //set the color to "on"
		theBtn.collider.enabled = true; //enable button collider
	}
}

