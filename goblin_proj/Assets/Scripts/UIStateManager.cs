/*==============================================================================
Copyright (c) 2013-2014 Qualcomm Connected Experiences, Inc.
All Rights Reserved.
==============================================================================*/

using UnityEngine;
using System.Collections;
using Vuforia;

public enum UIStates
{
    OVERLAY_OUTLINE, INIT_ANIMATION, SCANNING, GAME_RENDERING, GAME_PLAY, RESET_ALL, NONE
}

/// <summary>
/// Manages all UI States in the app
/// </summary>
public class UIStateManager : MonoBehaviour
{
    #region PUBLIC_MEMBERS

    public Penguin m_penguin;

    #endregion //PUBLIC_MEMBERS

    #region PRIVATE_MEMBERS

    private static UIStateManager s_UIStateManager;
    private UIStates m_state;
    private GUIInputManager m_uiInput;
    private SurfaceBehaviour m_smartSurface;
    private ReconstructionBehaviour m_reconstructionBehaviour;
    private SmartTerrainEventHandler m_smartTerrainEventHandler;
    private CylinderTrackableEventHandler m_cylinderTrackableHandler;
    private SmartTerrainTrackableEventHandler m_smartTerrainTrackableHandler;

    //For handling license error
    private SampleInitErrorHandler mPopUpMsg;
    private bool mErrorOccurred;

    #endregion //PRIVATE_MEMBERS

    #region UNITY_MONOBEHAVIOUR

    void Start()
    {

        mPopUpMsg = GetComponent<SampleInitErrorHandler>();
        if (!mPopUpMsg)
        {
            mPopUpMsg = gameObject.AddComponent<SampleInitErrorHandler>();

        }

        mPopUpMsg.InitPopUp();
        // register callback methods
        QCARAbstractBehaviour qcarBehaviour = (QCARAbstractBehaviour)FindObjectOfType(typeof(QCARAbstractBehaviour));
        if (qcarBehaviour)
        {
            qcarBehaviour.RegisterQCARStartedCallback(OnQCARStarted);
            qcarBehaviour.RegisterQCARInitErrorCallback(OnQCARInitializationError);
        }

        //Assign all references
        m_reconstructionBehaviour = FindObjectOfType(typeof(ReconstructionBehaviour)) as ReconstructionBehaviour;
        m_uiInput = new GUIInputManager();
        m_cylinderTrackableHandler = FindObjectOfType(typeof(CylinderTrackableEventHandler)) as CylinderTrackableEventHandler;
        m_smartTerrainEventHandler = GameObject.FindObjectOfType(typeof(SmartTerrainEventHandler)) as SmartTerrainEventHandler;
        m_smartSurface = GameObject.FindObjectOfType(typeof(SurfaceBehaviour)) as SurfaceBehaviour;
        m_smartTerrainTrackableHandler = GameObject.FindObjectOfType(typeof(SmartTerrainTrackableEventHandler)) as SmartTerrainTrackableEventHandler;
        //Register to events
        m_cylinderTrackableHandler.CylinderTrackableFoundFirstTime += OnCylinderTrackableFoundFirstTime;
        m_uiInput.TappedOnDoneButton += OnTappedOnDone;
        m_uiInput.TappedOnResetButton += OnTappedOnReset;
    }

    //All the UI states are managed here.

    void OnGUI()
    {
        if (mErrorOccurred)
        {
            mPopUpMsg.Draw();
            return;
        }

        switch (m_state)
        {
            //Detection phase
            case UIStates.OVERLAY_OUTLINE:
                m_uiInput.UpdateTitle(HEADER_MESSAGE.POINT_THE_DEVICE);
                m_smartSurface.GetComponent<Renderer>().enabled = false;
                m_uiInput.DrawCylinderOutline();
                break;

            //Soda can ice animating phase
            case UIStates.INIT_ANIMATION:
                m_smartSurface.GetComponent<Renderer>().enabled = false;
                Ice anim = GameObject.FindObjectOfType(typeof(Ice)) as Ice;
                anim.Play();
                if (anim.DidFinishAnimation)
                {
                    m_smartSurface.GetComponent<Renderer>().enabled = m_smartTerrainTrackableHandler.m_trackablesFound;
                    m_state = UIStates.SCANNING;
                }
                break;

            //Scanning phase
            case UIStates.SCANNING:
                m_smartSurface.GetComponent<Renderer>().enabled = m_smartTerrainTrackableHandler.m_trackablesFound;
                m_uiInput.UpdateTitle(HEADER_MESSAGE.PULLBACK_SLOWLY);
                m_uiInput.DrawDoneButton();
                break;

            //Icebergs rendering phase - user taps on [DONE] button 
            case UIStates.GAME_RENDERING:
                if ((m_reconstructionBehaviour != null) && (m_reconstructionBehaviour.Reconstruction != null))
                {
                    m_smartTerrainEventHandler.ShowPropClones();
                    m_reconstructionBehaviour.Reconstruction.Stop();
                    m_state = UIStates.GAME_PLAY;
                }
                break;

            //Penguin appears and user taps on surface to move the penguin around
            case UIStates.GAME_PLAY:
                if (m_smartTerrainEventHandler.propsCloned && !m_penguin.DidAppear)
                {
                    m_penguin.gameObject.SetActive(true);
                }

                if (m_penguin.DidAppear)
                {
                    //Update UI messaging
                    m_uiInput.UpdateTitle(HEADER_MESSAGE.TAP_ICE);
                    m_uiInput.DrawResetButton();
                }
                break;

            //User taps on [RESET] button - Re-loads the level
            case UIStates.RESET_ALL:

                //Go back to loading scene
                Application.LoadLevelAsync(1);
                m_state = UIStates.NONE;

                break;

            //just a placeholder state, to make sure that the previous state runs for just one frame.
            case UIStates.NONE: break;
        }
    }

    void OnDestroy()
    {
        // unregister callback methods
        QCARAbstractBehaviour qcarBehaviour = (QCARAbstractBehaviour)FindObjectOfType(typeof(QCARAbstractBehaviour));
        if (qcarBehaviour)
        {
            qcarBehaviour.UnregisterQCARStartedCallback(OnQCARStarted);
            qcarBehaviour.UnregisterQCARInitErrorCallback(OnQCARInitializationError);
        }
    }

    #endregion //UNITY_MONOBEHAVIOUR



    #region PRIVATE_METHODS

    private void OnCylinderTrackableFoundFirstTime()
    {
        m_state = UIStates.INIT_ANIMATION;
    }

    private void OnTappedOnDone()
    {
        m_state = UIStates.GAME_RENDERING;
    }

    private void OnTappedOnReset()
    {
        m_state = UIStates.RESET_ALL;
    }

    #endregion //PRIVATE_METHODS



    #region QCAR_Callbacks

    public void OnQCARStarted()
    {
        //Set Continous Focus Mode for a smoother experience
        CameraDevice.Instance.SetFocusMode(CameraDevice.FocusMode.FOCUS_MODE_CONTINUOUSAUTO);
    }

    public void OnQCARInitializationError(QCARUnity.InitError initError)
    {
        if (initError != QCARUnity.InitError.INIT_SUCCESS)
        {
            mErrorOccurred = true;
            mPopUpMsg.SetErrorCode(initError);
        }
    }

    #endregion // QCAR_Callbacks
}
