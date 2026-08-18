import React from 'react'
import '../styles/mascot.scss'

/**
 * InteractiveAuthMascot — Static Mascot Placement
 * Placed sitting naturally on top of the authentication card.
 */
const InteractiveAuthMascot = () => {
    return (
        <div className="auth-mascot-wrapper" aria-hidden="true">
            <div className="mascot-body-layer">
                <img 
                    src="/mascot_body.png" 
                    alt="" 
                    className="mascot-img"
                    draggable="false"
                />
            </div>
            <div className="mascot-hands-layer">
                <img 
                    src="/mascot_hands.png" 
                    alt="" 
                    className="mascot-hands-img"
                    draggable="false"
                />
            </div>
        </div>
    )
}

export default InteractiveAuthMascot
