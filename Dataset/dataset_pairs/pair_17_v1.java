/* version one */
package com.alibaba.dubbo.remoting.transport;

import com.alibaba.dubbo.remoting.ChannelHandler;

/**
 * @author chao.liuc
 */
public interface ChannelHandlerDel extends ChannelHandler {

    public ChannelHandler getHandlerPre();
}
