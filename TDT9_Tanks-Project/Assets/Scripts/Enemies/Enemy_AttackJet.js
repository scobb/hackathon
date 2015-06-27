#pragma strict

class Enemy_AttackJet extends Enemy_Base
{
	//range of heights to start at
	var heightRange : Vector2 = Vector2(10.0, 18.0);

	function Start () 
	{
		//choose a random height
		transform.position.y = Random.Range(heightRange.x, heightRange.y);
	}

	function Update () 
	{	
		//make the jet move forward at speed
		transform.Translate(Vector3.forward * (forwardSpeed * Time.deltaTime));
	}
}